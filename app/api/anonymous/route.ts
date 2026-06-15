import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — ensure an anonymous profile exists for the given UID, return the profile ID
export async function POST(request: Request) {
    const supabase = await createClient();
    const body = await request.json();
    const { anonymousUid, displayName, avatarUrl } = body;

    if (!anonymousUid) {
        return NextResponse.json(
            { error: "anonymousUid is required" },
            { status: 400 }
        );
    }

    // Check if profile already exists for this anonymous UID
    const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("anonymous_uid", anonymousUid)
        .single();

    if (existing) {
        return NextResponse.json({ profileId: existing.id });
    }

    // Create a new anonymous profile
    const profileId = crypto.randomUUID();
    const { error } = await supabase.from("profiles").insert({
        id: profileId,
        display_name: displayName ?? "Anonymous",
        avatar_url: avatarUrl ?? null,
        is_anonymous: true,
        anonymous_uid: anonymousUid,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profileId });
}
