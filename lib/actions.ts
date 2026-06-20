"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { ANON_UID_COOKIE } from "@/lib/constants";
import { getLeaderboardData } from "@/lib/leaderboard";
import { scoreSubmission } from "@/lib/score-submission";
import { generateServerWords, type ServerTestMode } from "@/lib/server-words";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { resolveUser } from "@/lib/supabase/resolve-user";
import { createClient } from "@/lib/supabase/server";
import { createChallenge, verifyChallenge } from "@/lib/test-challenge";
import { isRankedTopic } from "@/lib/topic-options";
import type { TestSubmission } from "@/lib/types";
import { getVisitorCount } from "@/lib/visitor-count";
import type { Difficulty } from "@/lib/words";

// Reject more than one save per profile inside this window — a genuine test
// takes at least a couple of seconds plus reading time, so rapid-fire inserts
// indicate scripted leaderboard spam rather than real runs.
const MIN_SAVE_INTERVAL_MS = 1500;

export interface StartTestInput {
    difficulty?: Difficulty;
    mode: ServerTestMode;
    modeDetail: string;
    numbers?: boolean;
    punctuation?: boolean;
    /** content source; non-default topics produce unranked themed text */
    topic?: string;
}

export interface StartTestResult {
    author: string | null;
    /** opaque signed challenge — echoed back unchanged on submit */
    token: string;
    words: string[];
}

/**
 * Begin a test: the SERVER picks the words and signs them into a challenge.
 * The client must type against exactly these words; it cannot choose its own.
 * Returns `null` if no identity can be resolved (caller falls back to a local,
 * unranked test that is never saved to the DB).
 */
export async function startTest(
    input: StartTestInput
): Promise<StartTestResult | null> {
    const resolved = await resolveUser();
    if (!resolved) {
        return null;
    }

    const { words, author } = generateServerWords({
        mode: input.mode,
        modeDetail: input.modeDetail,
        topic: input.topic,
        punctuation: input.punctuation,
        numbers: input.numbers,
        difficulty: input.difficulty,
    });

    const durationSeconds =
        input.mode === "time" ? Number(input.modeDetail) || 0 : 0;

    const token = createChallenge({
        uid: resolved.profileId,
        mode: input.mode,
        modeDetail: input.modeDetail,
        durationSeconds,
        words,
        ranked: isRankedTopic(input.topic),
    });

    return { words, author, token };
}

export interface SubmitTestInput extends TestSubmission { }

/**
 * Submit a completed run. The server re-derives the score from its own signed
 * word list and the player's raw typed input + keystroke timing — the
 * client-computed numbers are never trusted. Returns the authoritative score on
 * success so the UI can reconcile if it wishes.
 */
export async function submitTest(input: SubmitTestInput) {
    // 1. Verify the challenge signature + freshness.
    const payload = verifyChallenge(input.token);
    if (!payload) {
        return { success: false, error: "invalid_challenge" } as const;
    }

    // 2. The submitter must be the user the challenge was issued to.
    const resolved = await resolveUser();
    if (!resolved) {
        return { success: false, error: "No identity" } as const;
    }
    if (resolved.profileId !== payload.uid) {
        return { success: false, error: "identity_mismatch" } as const;
    }

    // Themed-topic / practice runs are never leaderboard-eligible. The `ranked`
    // flag is part of the SIGNED challenge, so a tampered client cannot flip a
    // practice run into a ranked one. We accept the submission but never persist
    // it — there is simply no DB row, so it can't reach the leaderboard.
    if (!payload.ranked) {
        return { success: true, unranked: true } as const;
    }

    // 3. Recompute the score authoritatively from server words + raw input.
    const outcome = scoreSubmission(payload, {
        wordInputs: input.wordInputs,
        typed: input.typed,
        wordIndex: input.wordIndex,
        keystrokeTimes: input.keystrokeTimes,
    });
    if (!outcome.ok) {
        return { success: false, error: `Rejected: ${outcome.reason}` } as const;
    }
    const { score } = outcome;

    // Trusted write path: the service-role client bypasses RLS, which is locked
    // down so clients can NEVER insert results directly (migration 004). If it
    // isn't configured we fail closed — the run stays in localStorage only
    // rather than falling back to an insecure path.
    let supabase: ReturnType<typeof createAdminClient>;
    try {
        supabase = createAdminClient();
    } catch {
        return { success: false, error: "writes_not_configured" } as const;
    }

    // 4. Lightweight rate limit: block bursts of saves from the same profile.
    const since = new Date(Date.now() - MIN_SAVE_INTERVAL_MS).toISOString();
    const { count: recentCount } = await supabase
        .from("test_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", resolved.profileId)
        .gte("created_at", since);
    if ((recentCount ?? 0) > 0) {
        return { success: false, error: "Rate limited" } as const;
    }

    // 5. Persist the SERVER-computed values.
    const { error } = await supabase.from("test_results").insert({
        user_id: resolved.profileId,
        wpm: score.wpm,
        raw: score.raw,
        accuracy: score.accuracy,
        consistency: score.consistency,
        mode: score.mode,
        mode_detail: score.modeDetail,
        elapsed_seconds: score.elapsedSeconds,
        correct_chars: score.correctChars,
        incorrect_chars: score.incorrectChars,
        extra_chars: score.extraChars,
        missed_chars: score.missedChars,
    });

    if (error) {
        return { success: false, error: error.message } as const;
    }

    // Invalidate leaderboard cache so the new score appears immediately
    revalidateTag("leaderboard", { expire: 0 });

    return { success: true, score } as const;
}

export async function getTestHistory() {
    const resolved = await resolveUser();
    if (!resolved) {
        return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("test_results")
        .select("*")
        .eq("user_id", resolved.profileId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        return [];
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
        wpm: row.wpm as number,
        raw: row.raw as number,
        accuracy: row.accuracy as number,
        consistency: row.consistency as number,
        mode: row.mode as string,
        modeDetail: row.mode_detail as string,
        date: row.created_at as string,
    }));
}

export async function migrateAnonymousData() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return { success: false };
    }

    const cookieStore = await cookies();
    const anonUid = cookieStore.get(ANON_UID_COOKIE)?.value;
    if (!anonUid) {
        return { success: true }; // Nothing to migrate
    }

    const { error } = await supabase.rpc("migrate_anonymous_to_user", {
        p_anonymous_uid: anonUid,
        p_user_id: user.id,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    // Invalidate leaderboard since user IDs changed for migrated scores
    revalidateTag("leaderboard", { expire: 0 });

    return { success: true };
}

export async function getResolvedIdentity() {
    const resolved = await resolveUser();
    if (!resolved) {
        return null;
    }
    return {
        displayName: resolved.displayName,
        avatarUrl: resolved.avatarUrl,
        isAnonymous: resolved.isAnonymous,
    };
}

// --- Leaderboard (delegates to cached layer) ---

export async function fetchLeaderboard(
    period: "global" | "weekly" | "daily" = "global",
    mode = "all"
) {
    return getLeaderboardData(period, mode);
}

// --- Visitor count ---

export async function fetchVisitorCount() {
    return getVisitorCount();
}

export async function incrementVisitorCount() {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("increment_visitor_count");
    if (error) {
        return 0;
    }

    // Invalidate visitor count cache so subsequent reads get the new value
    revalidateTag("visitor-count", { expire: 0 });

    return (data as number) ?? 0;
}
