import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for public (anonymous) reads.
 * Does NOT read cookies — safe for use inside "use cache" functions
 * without making the cache per-user.
 */
export function createPublicClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
}
