import "server-only";

import { cookies } from "next/headers";
import {
    generateAnonAvatarUrl,
    generateAnonName,
} from "@/lib/anonymous-identity";
import { ANON_UID_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export interface SerializedUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string;
}

export interface IdentityData {
    anonDisplayName: string;
    anonAvatarUrl: string;
    initialUser: SerializedUser | null;
}

export async function getIdentityData(): Promise<IdentityData> {
    const cookieStore = await cookies();
    const anonUid = cookieStore.get(ANON_UID_COOKIE)?.value ?? "";

    // Resolve authenticated user server-side — avoids client round-trip
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const anonDisplayName = anonUid ? generateAnonName(anonUid) : "Anonymous";
    const anonAvatarUrl = anonUid ? generateAnonAvatarUrl(anonUid) : "";

    if (user) {
        return {
            anonDisplayName,
            anonAvatarUrl,
            initialUser: {
                id: user.id,
                email: user.email ?? "",
                displayName:
                    user.user_metadata?.full_name ??
                    user.user_metadata?.name ??
                    "User",
                avatarUrl:
                    user.user_metadata?.avatar_url ??
                    user.user_metadata?.picture ??
                    "",
            },
        };
    }

    return { anonDisplayName, anonAvatarUrl, initialUser: null };
}
