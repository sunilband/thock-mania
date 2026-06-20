import "server-only";

import rawQuotes from "@/data/quotes.json";
import rawTopics from "@/data/topics.json";
import { TOPIC_OPTIONS, type TopicId } from "@/lib/topic-options";

/**
 * Topic content inventories. Each topic is a list of short passages; a run
 * concatenates random passages' words until it has enough. Themed runs are
 * always unranked (see lib/topic-options.isRankedTopic), so the exact wording
 * is flavour, not a score surface.
 *
 * ponytail: famous_quotes reuses the existing data/quotes.json inventory rather
 * than duplicating it. Other topics are curated in data/topics.json — expand
 * those arrays to add more variety (no code change needed).
 */
// A passage is usable only if every character is plain typeable English: ASCII
// letters, spaces and basic punctuation. This drops anything with digits,
// accented/foreign letters (é, ñ) or curly quotes/dashes — common in the reused
// quotes — since those can't be typed on a standard English keyboard.
const CLEAN_PASSAGE = /^[A-Za-z][A-Za-z .,!?;:'"()-]*$/;
const SPLIT_WHITESPACE = /\s+/;

function isCleanPassage(text: string): boolean {
    return CLEAN_PASSAGE.test(text.trim());
}

const RAW_PASSAGES: Record<string, string[]> = {
    ...(rawTopics as Record<string, string[]>),
    famous_quotes: (rawQuotes as { text: string }[]).map((q) => q.text),
};

const PASSAGES: Record<string, string[]> = Object.fromEntries(
    Object.entries(RAW_PASSAGES).map(([id, list]) => [
        id,
        list.filter(isCleanPassage),
    ])
);

// Every selectable topic that maps to themed content (excludes random_words,
// which uses the standard word pools, and random_topics, which picks from these).
const THEMED_TOPIC_IDS: TopicId[] = TOPIC_OPTIONS.map((t) => t.id).filter(
    (id) => id !== "random_words" && id !== "random_topics"
);

function shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/**
 * Build a `count`-long word stream for a topic. `random_topics` resolves to a
 * random themed topic. Unknown ids fall back to `science` so a stale persisted
 * value can never produce an empty test.
 */
export function getTopicWords(topicId: string, count: number): string[] {
    let id = topicId;
    if (id === "random_topics") {
        id = THEMED_TOPIC_IDS[Math.floor(Math.random() * THEMED_TOPIC_IDS.length)];
    }
    const passages = PASSAGES[id]?.length ? PASSAGES[id] : PASSAGES.science;

    const deck = [...passages];
    // No clean passages anywhere ⇒ nothing safe to type; return empty rather
    // than looping forever (the caller shows a skeleton until the next reset).
    if (deck.length === 0) {
        return [];
    }
    shuffleInPlace(deck);

    const words: string[] = [];
    let i = 0;
    while (words.length < count) {
        if (i >= deck.length) {
            shuffleInPlace(deck);
            i = 0;
        }
        for (const w of deck[i].split(SPLIT_WHITESPACE)) {
            if (w) {
                words.push(w);
            }
        }
        i += 1;
    }
    return words.slice(0, count);
}
