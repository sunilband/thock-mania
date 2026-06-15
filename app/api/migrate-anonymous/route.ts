import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — migrate anonymous user's data to the logged-in user
export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { anonymousUid } = body;

    if (!anonymousUid) {
        return NextResponse.json(
            { error: "anonymousUid is required" },
            { status: 400 }
        );
    }

    // Call the migration function
    const { error } = await supabase.rpc("migrate_anonymous_to_user", {
        p_anonymous_uid: anonymousUid,
        p_user_id: user.id,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
