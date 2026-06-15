import {
    adjectives,
    animals,
    uniqueNamesGenerator,
} from "unique-names-generator";

const ANON_UID_KEY = "kz-anon-uid";

/**
 * Get or create an anonymous UID stored in localStorage.
 * This persists across sessions for the same browser.
 */
export function getAnonymousUid(): string {
    if (typeof window === "undefined") return "";

    let uid = localStorage.getItem(ANON_UID_KEY);
    if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem(ANON_UID_KEY, uid);
    }
    return uid;
}

/**
 * Generate a deterministic display name from a UID seed.
 * Always produces the same name for the same UID.
 */
export function generateAnonName(uid: string): string {
    // Use the UID as a seed for consistent name generation
    const seed = hashCode(uid);
    return uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: " ",
        seed,
        style: "capital",
    });
}

/**
 * Generate a deterministic avatar URL using DiceBear Shapes API.
 * Returns an SVG data URI so no external requests are made at render time.
 * We use the uid as the seed for the DiceBear "shapes" style.
 */
export function generateAnonAvatarUrl(uid: string): string {
    // Use DiceBear API URL — these are cached by the browser
    return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(uid)}&size=64`;
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash);
}
