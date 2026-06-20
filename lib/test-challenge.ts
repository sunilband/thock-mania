import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Stateless, signed test challenges.
 *
 * When a test starts the server generates the word list and wraps it — together
 * with the resolved user id, mode and an issued-at timestamp — into a token
 * that is signed with a server-only secret (HMAC-SHA256). The client renders the
 * words and echoes the *opaque* token back on submit. Because any change to the
 * token invalidates the signature, the client cannot:
 *   - swap in easier words,
 *   - claim a different mode/duration than was issued,
 *   - submit on behalf of another user,
 *   - or replay a stale token (it expires).
 *
 * No DB table is needed; the secret never leaves the server.
 */

const TTL_MS = 15 * 60 * 1000; // a challenge is valid for 15 minutes

// In production TEST_SIGNING_SECRET MUST be set (and stable across all server
// instances, or tokens issued by one instance won't verify on another). The dev
// fallback keeps local development working without configuration.
function getSecret(): string {
    const secret = process.env.TEST_SIGNING_SECRET;
    if (secret && secret.length >= 16) {
        return secret;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "TEST_SIGNING_SECRET is not configured — refusing to sign test challenges."
        );
    }
    return "dev-only-insecure-test-signing-secret-change-me";
}

export interface ChallengePayload {
    /** time-mode duration in seconds (0 for non-time modes) */
    durationSeconds: number;
    /** issued-at epoch ms */
    iat: number;
    mode: string;
    modeDetail: string;
    /** false ⇒ practice/themed-topic run: server refuses to persist it */
    ranked: boolean;
    /** unique id for this challenge (anti-replay aid) */
    sid: string;
    /** resolved profile id the challenge was issued to */
    uid: string;
    /** authoritative target words the run will be graded against */
    words: string[];
}

function sign(data: string): string {
    return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** Build a signed, opaque challenge token. */
export function createChallenge(
    payload: Omit<ChallengePayload, "sid" | "iat">
): string {
    const full: ChallengePayload = {
        ...payload,
        sid: randomUUID(),
        iat: Date.now(),
    };
    const body = Buffer.from(JSON.stringify(full)).toString("base64url");
    return `${body}.${sign(body)}`;
}

/** Verify a token's signature and freshness; returns the payload or null. */
export function verifyChallenge(token: unknown): ChallengePayload | null {
    if (typeof token !== "string" || !token.includes(".")) {
        return null;
    }
    const [body, providedSig] = token.split(".", 2);
    if (!(body && providedSig)) {
        return null;
    }

    const expectedSig = sign(body);
    // Constant-time comparison to avoid signature-timing oracles.
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return null;
    }

    let payload: ChallengePayload;
    try {
        payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    } catch {
        return null;
    }

    if (
        typeof payload?.iat !== "number" ||
        Date.now() - payload.iat > TTL_MS ||
        !Array.isArray(payload.words)
    ) {
        return null;
    }

    return payload;
}
