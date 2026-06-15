import { cookies } from "next/headers";
import {
    generateAnonAvatarUrl,
    generateAnonName,
} from "@/lib/anonymous-identity";
import { createClient } from "@/lib/supabase/server";

export interface ResolvedUser {
    /** The profile ID to use for DB operations */
    profileId: string;
    /** Whether this is an anonymous user */
    isAnonymous: boolean;
    /** Display name */
    displayName: string;
    /** Avatar URL */
    avatarUrl: string;
}

/**
 * Resolve the current user from cookies — either authenticated Supabase user
 * or anonymous user via the `kz-anon-uid` cookie.
 * Creates the anonymous profile in the DB if it doesn't exist yet.
 */
export async function resolveUser(): Promise<ResolvedUser | null> {
    const supabase = await createClient();

    // Check for authenticated user first
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        return {
            profileId: user.id,
            isAnonymous: false,
            displayName:
                user.user_metadata?.full_name ??
                user.user_metadata?.name ??
                "User",
            avatarUrl:
                user.user_metadata?.avatar_url ??
                user.user_metadata?.picture ??
                "",
        };
    }

    // Fall back to anonymous UID from cookie
    const cookieStore = await cookies();
    const anonUid = cookieStore.get("kz-anon-uid")?.value;

    if (!anonUid) {
        return null;
    }

    // Check if anonymous profile already exists
    const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("anonymous_uid", anonUid)
        .single();

    if (existing) {
        return {
            profileId: existing.id,
            isAnonymous: true,
            displayName: generateAnonName(anonUid),
            avatarUrl: generateAnonAvatarUrl(anonUid),
        };
    }

    // Create anonymous profile on the fly
    const profileId = crypto.randomUUID();
    const displayName = generateAnonName(anonUid);
    const avatarUrl = generateAnonAvatarUrl(anonUid);

    const { error } = await supabase.from("profiles").insert({
        id: profileId,
        display_name: displayName,
        avatar_url: avatarUrl,
        is_anonymous: true,
        anonymous_uid: anonUid,
    });

    if (error) {
        return null;
    }

    return {
        profileId,
        isAnonymous: true,
        displayName,
        avatarUrl,
    };
}
