"use server";

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { ANON_UID_COOKIE } from "@/lib/constants";
import { resolveUser } from "@/lib/supabase/resolve-user";
import { createClient } from "@/lib/supabase/server";

export interface SaveTestResultInput {
    accuracy: number;
    consistency: number;
    correctChars: number;
    elapsedSeconds: number;
    extraChars: number;
    incorrectChars: number;
    missedChars: number;
    mode: string;
    modeDetail: string;
    raw: number;
    wpm: number;
}

export async function saveTestResult(input: SaveTestResultInput) {
    const resolved = await resolveUser();
    if (!resolved) return { success: false, error: "No identity" };

    const supabase = await createClient();

    const { error } = await supabase.from("test_results").insert({
        user_id: resolved.profileId,
        wpm: input.wpm,
        raw: input.raw,
        accuracy: input.accuracy,
        consistency: input.consistency,
        mode: input.mode,
        mode_detail: input.modeDetail,
        elapsed_seconds: input.elapsedSeconds,
        correct_chars: input.correctChars,
        incorrect_chars: input.incorrectChars,
        extra_chars: input.extraChars,
        missed_chars: input.missedChars,
    });

    if (error) return { success: false, error: error.message };

    // Invalidate leaderboard cache so the new score appears immediately
    revalidateTag("leaderboard", { expire: 0 });

    return { success: true };
}

export async function getTestHistory() {
    const resolved = await resolveUser();
    if (!resolved) return [];

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("test_results")
        .select("*")
        .eq("user_id", resolved.profileId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) return [];

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
    if (!user) return { success: false };

    const cookieStore = await cookies();
    const anonUid = cookieStore.get(ANON_UID_COOKIE)?.value;
    if (!anonUid) return { success: true }; // Nothing to migrate

    const { error } = await supabase.rpc("migrate_anonymous_to_user", {
        p_anonymous_uid: anonUid,
        p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };

    // Invalidate leaderboard since user IDs changed for migrated scores
    revalidateTag("leaderboard", { expire: 0 });

    return { success: true };
}

export async function getResolvedIdentity() {
    const resolved = await resolveUser();
    if (!resolved) return null;
    return {
        displayName: resolved.displayName,
        avatarUrl: resolved.avatarUrl,
        isAnonymous: resolved.isAnonymous,
    };
}

// --- Leaderboard (delegates to cached layer) ---

export async function fetchLeaderboard(
    period: "global" | "weekly" | "daily" = "global",
    mode?: string
) {
    const { getLeaderboardData } = await import("@/lib/leaderboard");
    return getLeaderboardData(period, mode);
}

// --- Visitor count ---

export async function fetchVisitorCount() {
    const { getVisitorCount } = await import("@/lib/visitor-count");
    return getVisitorCount();
}

export async function incrementVisitorCount() {
    const { createPublicClient } = await import("@/lib/supabase/public");
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("increment_visitor_count");
    if (error) return 0;

    // Invalidate visitor count cache so subsequent reads get the new value
    revalidateTag("visitor-count", { expire: 0 });

    return (data as number) ?? 0;
}
