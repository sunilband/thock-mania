import "server-only";
import { getQuote, type QuoteLength } from "@/lib/quotes";
import { isRankedTopic } from "@/lib/topic-options";
import { getTopicWords } from "@/lib/topics";
import { type Difficulty, generateWordsFromPool } from "@/lib/words";
import englishWords from "@/public/languages/english.json";
import english1kWords from "@/public/languages/english_1k.json";

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
    difficulty?: Difficulty;
    mode: ServerTestMode;
    modeDetail: string;
    numbers?: boolean;
    punctuation?: boolean;
    /** content source; non-default topics are unranked themed text */
    topic?: string;
}

export interface GeneratedWords {
    author: string | null;
    words: string[];
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
    // Themed topics override the word source entirely (and are always unranked).
    // Length still follows the active mode/duration.
    if (opts.topic && !isRankedTopic(opts.topic)) {
        const count = wordCountFor(opts.mode);
        const n =
            opts.mode === "words"
                ? Number(opts.modeDetail) || count
                : count;
        return { words: getTopicWords(opts.topic, n), author: null };
    }

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
