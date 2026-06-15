import type { Metadata } from "next";
import { getLeaderboardData } from "@/lib/leaderboard";
import { LeaderboardClient } from "./leaderboard-client";

export const metadata: Metadata = {
    title: "Leaderboard",
    description: "Top typing scores from Thock Mania players worldwide.",
};

export default async function LeaderboardPage() {
    // Prefetch default (global, all modes) leaderboard data — cached via "use cache"
    const initialEntries = await getLeaderboardData("global", "all");

    return <LeaderboardClient initialEntries={initialEntries} />;
}
