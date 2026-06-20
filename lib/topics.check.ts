/**
 * Runnable self-check for getTopicWords. No framework — run with:
 *   bun --conditions react-server lib/topics.check.ts
 * (lib/topics is server-only, so it must resolve under the react-server
 * condition, the same way Next.js server code imports it.)
 * Fails loudly if the topic word stream is the wrong length, empty, or if an
 * unknown topic id doesn't fall back to real content.
 */
import assert from "node:assert/strict";
import { getTopicWords } from "@/lib/topics";

for (const [topic, count] of [
    ["science", 200],
    ["famous_quotes", 50],
    ["random_topics", 25],
    ["totally_unknown_topic", 10], // must fall back, never empty
] as const) {
    const words = getTopicWords(topic, count);
    assert.equal(words.length, count, `${topic} should yield exactly ${count} words`);
    assert.ok(
        words.every((w) => typeof w === "string" && w.length > 0),
        `${topic} produced an empty/blank word`
    );
}

// Asking for more words than a topic's raw passage count still fills via wrap-around.
assert.equal(getTopicWords("songs", 1000).length, 1000, "should wrap to reach count");

// Every emitted word must be plain typeable English: no digits, no non-ASCII
// (accented/foreign) characters. Guards the passage filter.
const CLEAN_WORD = /^[A-Za-z.,!?;:'"()-]+$/;
for (const topic of ["famous_quotes", "science", "history", "songs", "pop_culture"]) {
    for (const word of getTopicWords(topic, 300)) {
        assert.ok(
            CLEAN_WORD.test(word),
            `${topic} produced a non-English/numeric word: ${JSON.stringify(word)}`
        );
    }
}

console.log("topics.check passed");
