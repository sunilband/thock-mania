import { type NextRequest, NextResponse } from "next/server";
import { getLeaderboardData } from "@/lib/leaderboard";

// GET — fetch leaderboard with optional period and mode filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") ?? "global") as
    | "global"
    | "weekly"
    | "daily";
  const mode = searchParams.get("mode") ?? "all";

  const entries = await getLeaderboardData(period, mode);

  return NextResponse.json({ entries });
}
