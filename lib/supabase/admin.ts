import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged, server-only Supabase client using the SERVICE ROLE key.
 *
 * The service-role key bypasses Row Level Security, so this client is the ONLY
 * thing that can write to `test_results` once direct client inserts are locked
 * down (migration 004). It must never be imported into client code — the
 * `server-only` guard enforces that at build time, and the key is read from a
 * non-`NEXT_PUBLIC_` env var so it is never shipped to the browser.
 *
 * Use exclusively for trusted writes where identity + score have already been
 * resolved/verified server-side (see lib/actions.ts `submitTest`).
 */
export function createAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not configured — cannot perform trusted writes."
        );
    }
    return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
