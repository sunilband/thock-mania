/**
 * Topic = the content source for a typing test. `random_words` is the default
 * and the ONLY topic that counts toward the leaderboard; every other topic is a
 * practice run (see lib/topics.ts + the `ranked` flag signed into the challenge
 * in lib/test-challenge.ts). Client-safe (no JSON import) so the header dropdown
 * and the settings provider can both use it.
 */

export type TopicId =
    | "random_words"
    | "random_topics"
    | "famous_quotes"
    | "songs"
    | "pop_culture"
    | "history"
    | "science"
    | "technology"
    | "nature"
    | "sports";

export interface TopicOption {
    description: string;
    id: TopicId;
    label: string;
}

export const DEFAULT_TOPIC: TopicId = "random_words";

export const TOPIC_OPTIONS: readonly TopicOption[] = [
    {
        id: "random_words",
        label: "Random words",
        description: "The classic shuffled word list. Counts on the leaderboard.",
    },
    {
        id: "random_topics",
        label: "Random topic",
        description: "Surprise me with any themed topic below.",
    },
    {
        id: "famous_quotes",
        label: "Famous quotes",
        description: "Memorable lines from across history.",
    },
    {
        id: "songs",
        label: "Songs & music",
        description: "Music history and trivia.",
    },
    {
        id: "pop_culture",
        label: "Pop culture",
        description: "Movies, shows, and internet life.",
    },
    {
        id: "history",
        label: "History",
        description: "Moments that shaped the world.",
    },
    {
        id: "science",
        label: "Science",
        description: "Facts about how things work.",
    },
    {
        id: "technology",
        label: "Technology",
        description: "Computers, code, and gadgets.",
    },
    { id: "nature", label: "Nature", description: "The living world around us." },
    {
        id: "sports",
        label: "Sports",
        description: "Games, records, and athletes.",
    },
] as const;

const TOPIC_IDS = new Set<string>(TOPIC_OPTIONS.map((t) => t.id));

export function isTopicId(value: unknown): value is TopicId {
    return typeof value === "string" && TOPIC_IDS.has(value);
}

/** Only `random_words` produces a leaderboard-eligible (ranked) run. */
export function isRankedTopic(topic: string | undefined): boolean {
    return !topic || topic === DEFAULT_TOPIC;
}
