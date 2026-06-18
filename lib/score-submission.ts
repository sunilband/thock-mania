import "server-only";
import type { ChallengePayload } from "@/lib/test-challenge";
import { accuracyFromCounts, countWpm, wpmNumeratorFromCounts } from "@/lib/wpm-count";

/**
 * Authoritative server-side scoring.
 *
 * The server recomputes every ranked number (WPM, raw, accuracy, character
 * breakdown) from:
 *   - the target words it generated and signed (`payload.words`), and
 *   - the player's actual typed word-inputs, run through the SAME `countWpm`
 *     the client uses — so honest runs match what the player saw.
 *
 * Client-reported scores are never trusted or stored. The remaining lever a
 * cheater has is to fabricate a believable keystroke *timeline*; `validateTiming`
 * is what makes that hard — it rejects superhuman speed, machine-perfect cadence
 * and timelines that don't physically support the claimed characters.
 */

// Human typing ceilings (mirror lib/validate-result.ts).
const MAX_CHARS_PER_SEC = 30;
const MIN_INTERVAL_MS = 12; // a single sub-12ms gap is fine; many are not
const MAX_SUBHUMAN_RATIO = 0.1; // >10% sub-12ms intervals ⇒ auto-typer
const MIN_ELAPSED_SECONDS = 2;
const MAX_ELAPSED_SECONDS = 3600;
const MAX_CHARS = 20_000;
const BOT_CADENCE_MIN_KEYS = 20; // need enough samples to judge cadence
const BOT_CADENCE_MIN_CV = 0.05; // inter-key interval CV below this ⇒ robotic

export interface SubmissionInput {
    /** committed per-word inputs, index-aligned with the target words */
    wordInputs: string[];
    /** the in-progress final word (uncommitted) */
    typed: string;
    /** index of the active word */
    wordIndex: number;
    /** ms offset (from test start) of every character + space keystroke, in order */
    keystrokeTimes: number[];
}

export type ScoreReason =
    | "malformed_submission"
    | "no_keystrokes"
    | "too_short"
    | "out_of_range"
    | "char_count_mismatch"
    | "non_monotonic_timeline"
    | "impossible_cps"
    | "superhuman_intervals"
    | "robotic_cadence"
    | "timeline_exceeds_duration";

export interface ServerScore {
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

export type ScoreOutcome =
    | { ok: true; score: ServerScore }
    | { ok: false; reason: ScoreReason };

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isFiniteNumberArray(v: unknown): v is number[] {
    return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}

/** Per-second steadiness of typing speed, derived purely from keystroke timing. */
function consistencyFromTimeline(times: number[]): number {
    if (times.length < 2) {
        return 100;
    }
    // Bucket keystrokes into 1-second bins, convert each active second's count to
    // a raw WPM (chars/sec × 60 / 5), then measure the coefficient of variation.
    const perSecond = new Map<number, number>();
    for (const t of times) {
        const sec = Math.floor(t / 1000);
        perSecond.set(sec, (perSecond.get(sec) ?? 0) + 1);
    }
    const rates = [...perSecond.values()].map((count) => (count * 60) / 5);
    if (rates.length < 2) {
        return 100;
    }
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
    return Math.max(0, Math.round(100 - (Math.sqrt(variance) / (mean || 1)) * 100));
}

function validateTiming(
    times: number[],
    elapsedSeconds: number,
    forwardChars: number,
    durationSeconds: number,
    hasFixedDuration: boolean
): ScoreReason | null {
    if (times.length === 0) {
        return "no_keystrokes";
    }
    if (times.length > MAX_CHARS) {
        return "out_of_range";
    }

    // Monotonic, non-negative timeline.
    for (let i = 0; i < times.length; i++) {
        if (times[i] < 0 || (i > 0 && times[i] < times[i - 1])) {
            return "non_monotonic_timeline";
        }
    }

    // Can't have committed more characters than keystrokes were recorded.
    if (forwardChars > times.length) {
        return "char_count_mismatch";
    }

    // In a timed (countdown) test no keystroke can land after the clock runs
    // out. Zen has no fixed duration, so this only applies to "time" mode.
    if (hasFixedDuration && times.at(-1)! > (durationSeconds + 2) * 1000) {
        return "timeline_exceeds_duration";
    }

    // Sustained characters-per-second ceiling.
    if (times.length / elapsedSeconds > MAX_CHARS_PER_SEC) {
        return "impossible_cps";
    }

    // Inter-key intervals: superhuman bursts and robotic uniformity.
    if (times.length > 1) {
        const intervals: number[] = [];
        let subhuman = 0;
        for (let i = 1; i < times.length; i++) {
            const dt = times[i] - times[i - 1];
            intervals.push(dt);
            if (dt < MIN_INTERVAL_MS) {
                subhuman++;
            }
        }
        if (subhuman / intervals.length > MAX_SUBHUMAN_RATIO) {
            return "superhuman_intervals";
        }
        if (times.length >= BOT_CADENCE_MIN_KEYS) {
            const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance =
                intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
            const cv = Math.sqrt(variance) / (mean || 1);
            if (cv < BOT_CADENCE_MIN_CV) {
                return "robotic_cadence";
            }
        }
    }

    return null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: a single linear scoring pipeline is clearer kept together
export function scoreSubmission(
    payload: ChallengePayload,
    input: SubmissionInput
): ScoreOutcome {
    // ── Shape guards ─────────────────────────────────────────────────────────
    if (
        !(
            input &&
            isStringArray(input.wordInputs) &&
            typeof input.typed === "string" &&
            typeof input.wordIndex === "number" &&
            Number.isInteger(input.wordIndex) &&
            input.wordIndex >= 0 &&
            isFiniteNumberArray(input.keystrokeTimes)
        )
    ) {
        return { ok: false, reason: "malformed_submission" };
    }

    const { mode, modeDetail, words: targetWords, durationSeconds } = payload;

    // ── Authoritative character scoring against the SERVER's words ───────────
    const counts = countWpm({
        targetWords,
        wordInputs: input.wordInputs,
        typed: input.typed,
        wordIndex: input.wordIndex,
        mode: mode as "time" | "words" | "quote" | "zen",
        final: true,
    });
    const numerator = wpmNumeratorFromCounts(counts);
    const accuracy = accuracyFromCounts(counts);

    const forwardChars =
        counts.allCorrectChars + counts.incorrectChars + counts.extraChars;
    const allTyped = input.keystrokeTimes.length;

    // ── Elapsed time (server-trusted) ────────────────────────────────────────
    // Timed runs are pinned to the signed duration; others derive from the
    // keystroke timeline the player actually produced.
    const lastOffsetSec =
        allTyped > 0 ? input.keystrokeTimes.at(-1)! / 1000 : 0;
    const elapsedSeconds =
        mode === "time" ? durationSeconds : Math.max(lastOffsetSec, 0);

    if (elapsedSeconds <= 0 || elapsedSeconds > MAX_ELAPSED_SECONDS) {
        return { ok: false, reason: "out_of_range" };
    }
    if (elapsedSeconds < MIN_ELAPSED_SECONDS) {
        return { ok: false, reason: "too_short" };
    }

    // ── Timing plausibility — the real anti-automation gate ──────────────────
    const timingReason = validateTiming(
        input.keystrokeTimes,
        elapsedSeconds,
        forwardChars,
        durationSeconds,
        mode === "time"
    );
    if (timingReason) {
        return { ok: false, reason: timingReason };
    }

    // ── Derive the ranked numbers ────────────────────────────────────────────
    const elapsedMin = elapsedSeconds / 60;
    const wpm = Math.round(numerator / 5 / elapsedMin);
    const raw = Math.max(Math.round(allTyped / 5 / elapsedMin), wpm);
    const consistency = consistencyFromTimeline(input.keystrokeTimes);

    // Final sanity ceilings (defense in depth; mirrors DB CHECK constraints).
    if (wpm < 0 || wpm > 300 || raw > 350 || accuracy < 0 || accuracy > 100) {
        return { ok: false, reason: "out_of_range" };
    }

    return {
        ok: true,
        score: {
            wpm,
            raw,
            accuracy,
            consistency,
            correctChars: counts.correctWordChars,
            incorrectChars: counts.incorrectChars,
            extraChars: counts.extraChars,
            missedChars: counts.missedChars,
            elapsedSeconds: Math.round(elapsedSeconds),
            mode,
            modeDetail,
        },
    };
}
