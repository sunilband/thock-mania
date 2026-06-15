import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — save a test result for logged-in user OR anonymous user (via profileId)
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  // Determine user_id: logged-in user takes priority, else use provided profileId
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? body.profileId;

  if (!userId) {
    return NextResponse.json(
      { error: "No user or profileId provided" },
      { status: 401 }
    );
  }

  const { error } = await supabase.from("test_results").insert({
    user_id: userId,
    wpm: body.wpm,
    raw: body.raw,
    accuracy: body.accuracy,
    consistency: body.consistency,
    mode: body.mode,
    mode_detail: body.modeDetail,
    elapsed_seconds: body.elapsedSeconds,
    correct_chars: body.correctChars ?? 0,
    incorrect_chars: body.incorrectChars ?? 0,
    extra_chars: body.extraChars ?? 0,
    missed_chars: body.missedChars ?? 0,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET — fetch user's own history (logged-in or anonymous via query param)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  // Logged-in user takes priority
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? profileId;

  if (!userId) {
    return NextResponse.json(
      { error: "No user or profileId provided" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ entries: [] }, { status: 500 });
  }

  const entries = (data ?? []).map((row: Record<string, unknown>) => ({
    wpm: row.wpm,
    raw: row.raw,
    accuracy: row.accuracy,
    consistency: row.consistency,
    mode: row.mode,
    modeDetail: row.mode_detail,
    date: row.created_at,
  }));

  return NextResponse.json({ entries });
}
