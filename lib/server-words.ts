import "server-only";
import englishWords from "@/public/languages/english.json";
import english1kWords from "@/public/languages/english_1k.json";
import { getQuote, type QuoteLength } from "@/lib/quotes";
import { type Difficulty, generateWordsFromPool } from "@/lib/words";

/**
 * SERVER-SIDE word generation.
 *
 * The whole point of the anti-cheat redesign is that the *server* decides which
 * words a run is graded against — never the client. If the client could choose
 * the target text it could pick trivial words ("a a a a") and "type" them
 * instantly. By generating here and signing the result (see lib/test-challenge),
 * the player can only ever be graded against text the server picked.
 */

const POOLS: Record<"easy" | "hard", string[]> = {
    easy: englishWords.words,
    hard: english1kWords.words,
};

export type ServerTestMode = "time" | "words" | "quote" | "zen";

export interface GenerateWordsOptions {
    mode: ServerTestMode;
    modeDetail: string;
    punctuation?: boolean;
    numbers?: boolean;
    difficulty?: Difficulty;
}

export interface GeneratedWords {
    words: string[];
    author: string | null;
}

// Mirror the client's word-count choices in the typing hook.
function wordCountFor(mode: ServerTestMode): number {
    if (mode === "time") {
        return 200;
    }
    if (mode === "zen") {
        return 100;
    }
    return 100; // overridden for "words" mode below
}

export function generateServerWords(
    opts: GenerateWordsOptions
): GeneratedWords {
    if (opts.mode === "quote") {
        const length = (
            ["short", "medium", "long"].includes(opts.modeDetail)
                ? opts.modeDetail
                : "medium"
        ) as QuoteLength;
        const { words, author } = getQuote(length);
        return { words, author };
    }

    const pool = opts.difficulty === "hard" ? POOLS.hard : POOLS.easy;

    let count = wordCountFor(opts.mode);
    if (opts.mode === "words") {
        const parsed = Number(opts.modeDetail);
        count = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
    }

    const words = generateWordsFromPool(pool, count, {
        punctuation: opts.punctuation,
        numbers: opts.numbers,
    });

    return { words, author: null };
}
