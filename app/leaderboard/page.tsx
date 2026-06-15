"use client";

import { CrownIcon, MedalIcon, TrophyIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
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

const ease = [0.25, 0.1, 0.25, 1] as const;

function getRankIcon(rank: number) {
    if (rank === 1) {
        return <CrownIcon className="text-yellow-500" size={18} weight="fill" />;
    }
    if (rank === 2) {
        return <MedalIcon className="text-gray-400" size={16} weight="fill" />;
    }
    if (rank === 3) {
        return <MedalIcon className="text-amber-600" size={16} weight="fill" />;
    }
    return null;
}

function getRankClass(rank: number) {
    if (rank === 1) {
        return "bg-yellow-500/5 border-yellow-500/20";
    }
    if (rank === 2) {
        return "bg-gray-400/5 border-gray-400/20";
    }
    if (rank === 3) {
        return "bg-amber-600/5 border-amber-600/20";
    }
    return "border-transparent";
}

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<"global" | "weekly" | "daily">("global");

    useEffect(() => {
        setLoading(true);
        fetch(`/api/leaderboard?period=${period}`)
            .then((res) => res.json())
            .then((data) => {
                setEntries(data.entries ?? []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [period]);

    return (
        <div className="flex flex-1 flex-col items-center px-4 py-8 md:px-10">
            <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl"
                initial={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.5, ease }}
            >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <TrophyIcon className="text-primary" size={28} weight="duotone" />
                        <div>
                            <h1 className="font-bold text-2xl text-foreground">Leaderboard</h1>
                            <p className="text-muted-foreground text-sm">
                                {period === "global" && "All-time top scores"}
                                {period === "weekly" && "Best scores this week"}
                                {period === "daily" && "Best scores today"}
                            </p>
                        </div>
                    </div>

                    {/* Period toggle */}
                    <div className="flex rounded-full border border-foreground/10 bg-foreground/[0.03] p-1">
                        {(["global", "weekly", "daily"] as const).map((p) => (
                            <button
                                className={cn(
                                    "relative rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                    period === p
                                        ? "text-foreground"
                                        : "text-muted-foreground hover:text-foreground/70"
                                )}
                                key={p}
                                onClick={() => setPeriod(p)}
                                type="button"
                            >
                                {period === p && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-foreground/[0.08]"
                                        layoutId="periodToggle"
                                        transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                                    />
                                )}
                                <span className="relative z-10 capitalize">{p}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <LeaderboardContent entries={entries} loading={loading} />
            </motion.div>
        </div>
    );
}

function LeaderboardContent({
    loading,
    entries,
}: { loading: boolean; entries: LeaderboardEntry[] }) {
    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        className="h-14 animate-pulse rounded-xl bg-foreground/[0.03]"
                        // biome-ignore lint: skeleton items
                        key={i}
                    />
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <TrophyIcon
                    className="text-muted-foreground/30"
                    size={48}
                    weight="duotone"
                />
                <p className="text-muted-foreground text-sm">
                    No scores yet. Be the first to claim the throne!
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                <span className="w-8 text-center">#</span>
                <span className="flex-1">Player</span>
                <span className="w-16 text-center">WPM</span>
                <span className="hidden w-14 text-center sm:block">Acc</span>
                <span className="hidden w-20 text-center md:block">Mode</span>
                <span className="hidden w-20 text-right lg:block">Date</span>
            </div>

            {entries.map((entry, i) => (
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-foreground/[0.02]",
                        getRankClass(entry.rank)
                    )}
                    initial={{ opacity: 0, y: 8 }}
                    key={entry.id}
                    transition={{ delay: i * 0.03, duration: 0.3, ease }}
                >
                    {/* Rank */}
                    <span className="flex w-8 items-center justify-center">
                        {getRankIcon(entry.rank) ?? (
                            <span className="font-mono text-muted-foreground/60 text-xs tabular-nums">
                                {entry.rank}
                            </span>
                        )}
                    </span>

                    {/* Player */}
                    <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
                        {entry.avatarUrl ? (
                            <img
                                alt={entry.displayName}
                                className="h-7 w-7 shrink-0 rounded-full object-cover"
                                src={entry.avatarUrl}
                            />
                        ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-medium text-primary text-xs">
                                {entry.displayName[0]?.toUpperCase()}
                            </div>
                        )}
                        <span className="truncate font-medium text-foreground text-sm">
                            {entry.displayName}
                        </span>
                    </div>

                    {/* WPM */}
                    <span className="w-16 text-center font-bold font-mono text-foreground tabular-nums">
                        {entry.wpm}
                    </span>

                    {/* Accuracy */}
                    <span className="hidden w-14 text-center font-mono text-muted-foreground text-xs tabular-nums sm:block">
                        {entry.accuracy}%
                    </span>

                    {/* Mode */}
                    <span className="hidden w-20 text-center text-muted-foreground/60 text-xs md:block">
                        {entry.mode} {entry.modeDetail}
                    </span>

                    {/* Date */}
                    <span className="hidden w-20 text-right text-[11px] text-muted-foreground/50 lg:block">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                        })}
                    </span>
                </motion.div>
            ))}
        </div>
    );
}
