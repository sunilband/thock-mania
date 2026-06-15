import {
    adjectives,
    animals,
    uniqueNamesGenerator,
} from "unique-names-generator";

/**
 * Generate a deterministic display name from a UID seed.
 * Always produces the same name for the same UID.
 */
export function generateAnonName(uid: string): string {
    const seed = hashCode(uid);
    return uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: " ",
        seed,
        style: "capital",
    });
}

/**
 * Generate a deterministic avatar URL using DiceBear Avataaars style.
 */
export function generateAnonAvatarUrl(uid: string): string {
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(uid)}&size=64`;
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash);
}
