"use cache";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

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

export interface LeaderboardEntry {
    accuracy: number;
    avatarUrl: string | null;
    consistency: number;
    createdAt: string;
    displayName: string;
    elapsedSeconds: number;
    id: string;
    mode: string;
    modeDetail: string;
    rank: number;
    raw: number;
    wpm: number;
}

export async function getLeaderboardData(
    period: "global" | "weekly" | "daily" = "global",
    mode: string = "all"
): Promise<LeaderboardEntry[]> {
    cacheTag("leaderboard", `leaderboard-${period}`, `leaderboard-${mode}`);
    // Global only changes when new scores arrive (handled by tag revalidation),
    // so it can live forever. Weekly/daily use rolling time windows computed at
    // cache-fill time, so they need a bounded lifetime to refresh the window.
    if (period === "global") {
        cacheLife("max");
    } else {
        cacheLife("hours");
    }

    const supabase = createPublicClient();

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

    if (mode && mode !== "all") {
        query = query.eq("mode", mode);
    }

    const { data, error } = await query;

    if (error) return [];

    // Deduplicate: keep only the highest WPM per user
    const seen = new Set<string>();
    const unique: TestResultRow[] = [];

    for (const row of (data || []) as unknown as TestResultRow[]) {
        if (seen.has(row.user_id)) continue;
        seen.add(row.user_id);
        unique.push(row);
        if (unique.length >= 50) break;
    }

    return unique.map((row, index) => ({
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
}
