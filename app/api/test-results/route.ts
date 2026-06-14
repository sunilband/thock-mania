import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — save a test result for the logged-in user
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase.from("test_results").insert({
    user_id: user.id,
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

// GET — fetch user's own history
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("user_id", user.id)
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
