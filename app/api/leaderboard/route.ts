import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TestResultRow {
  id: string;
  user_id: string;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  mode: string;
  mode_detail: string;
  elapsed_seconds: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

// GET — fetch leaderboard with optional period filter (global | weekly | daily)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "global";

  // Build date filter for weekly/daily
  let dateFilter: string | null = null;
  const now = new Date();
  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    dateFilter = start.toISOString();
  } else if (period === "weekly") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    dateFilter = start.toISOString();
  }

  let query = supabase
    .from("test_results")
    .select(
      `
      id,
      user_id,
      wpm,
      raw,
      accuracy,
      consistency,
      mode,
      mode_detail,
      elapsed_seconds,
      created_at,
      profiles (
        display_name,
        avatar_url
      )
    `
    )
    .order("wpm", { ascending: false })
    .limit(500);

  if (dateFilter) {
    query = query.gte("created_at", dateFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ entries: [] }, { status: 500 });
  }

  // Deduplicate: keep only the highest WPM per user
  const seen = new Set<string>();
  const unique: TestResultRow[] = [];

  for (const row of (data || []) as unknown as TestResultRow[]) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    unique.push(row);
    if (unique.length >= 50) break;
  }

  const entries = unique.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    wpm: row.wpm,
    raw: row.raw,
    accuracy: row.accuracy,
    consistency: row.consistency,
    mode: row.mode,
    modeDetail: row.mode_detail,
    elapsedSeconds: row.elapsed_seconds,
    createdAt: row.created_at,
    displayName: row.profiles?.display_name ?? "Anonymous",
    avatarUrl: row.profiles?.avatar_url ?? null,
  }));

  return NextResponse.json({ entries });
}
