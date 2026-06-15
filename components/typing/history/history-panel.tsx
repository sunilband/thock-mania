"use client";

import { ChartLineUp, TrashSimple, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import useMediaQuery from "@/hooks/use-media-query";
import {
  clearTestHistory,
  getTestHistory,
  type HistorySummary,
  summarizeHistory,
  type TestHistoryEntry,
} from "@/lib/test-history";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) {
    return "just now";
  }
  if (min < 60) {
    return `${min}m ago`;
  }
  const hrs = Math.floor(min / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function HistoryPanel({ open, onOpenChange }: HistoryPanelProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const swipe = isMobile ? "down" : "right";
  const [entries, setEntries] = useState<TestHistoryEntry[]>([]);
  const [summary, setSummary] = useState<HistorySummary>({
    averageAccuracy: 0,
    averageWpm: 0,
    bestWpm: 0,
    count: 0,
  });
  const { user, anonProfileId } = useAuth();

  // Re-read history whenever the panel opens so it reflects the latest runs.
  // Fetch from DB for both logged-in and anonymous users; fallback to localStorage.
  useEffect(() => {
    if (!open) {
      return;
    }

    const profileId = user ? undefined : anonProfileId;
    const hasDbAccess = user || profileId;

    if (hasDbAccess) {
      const url = profileId
        ? `/api/test-results?profileId=${profileId}`
        : "/api/test-results";
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.entries) {
            const dbEntries: TestHistoryEntry[] = data.entries.map(
              (e: Record<string, unknown>) => ({
                wpm: e.wpm as number,
                raw: e.raw as number,
                accuracy: e.accuracy as number,
                consistency: e.consistency as number,
                mode: e.mode as string,
                modeDetail: e.modeDetail as string,
                date: e.date as string,
              })
            );
            setEntries(dbEntries);
            setSummary(summarizeHistory(dbEntries));
          }
        })
        .catch(() => {
          // Fallback to localStorage
          const data = getTestHistory();
          setEntries(data);
          setSummary(summarizeHistory(data));
        });
    } else {
      const data = getTestHistory();
      setEntries(data);
      setSummary(summarizeHistory(data));
    }
  }, [open, user]);

  const popupClass = cn(
    "h-full",
    isMobile
      ? "mx-3! mb-3! flex max-h-[90dvh] flex-col rounded-2xl! [--bleed:0px]"
      : "m-3! flex h-[calc(100%-1.5rem)]! flex-col rounded-2xl! [--bleed:0px]"
  );

  function handleClear() {
    clearTestHistory();
    setEntries([]);
    setSummary({ averageAccuracy: 0, averageWpm: 0, bestWpm: 0, count: 0 });
  }

  return (
    <Drawer onOpenChange={onOpenChange} open={open} swipeDirection={swipe}>
      <DrawerPopup className={popupClass}>
        <DrawerContent className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <DrawerTitle className="font-semibold text-foreground text-sm">
              History
            </DrawerTitle>
            <DrawerClose className="flex items-center justify-center rounded-full bg-foreground/[0.06] p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground">
              <X size={14} />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <ChartLineUp
                className="text-muted-foreground/30"
                size={32}
                weight="duotone"
              />
              <p className="text-muted-foreground text-xs">
                No tests yet. Finish a run and it&apos;ll show up here.
              </p>
            </div>
          ) : (
            <>
              {/* Aggregate summary */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <SummaryStat label="avg wpm" value={summary.averageWpm} />
                <SummaryStat label="best wpm" value={summary.bestWpm} />
                <SummaryStat
                  label="avg acc"
                  suffix="%"
                  value={summary.averageAccuracy}
                />
              </div>

              {/* Recent runs */}
              <div className="mt-6 flex items-center justify-between px-1">
                <p className="font-semibold text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                  Recent ({summary.count})
                </p>
                <button
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:bg-foreground/[0.04] hover:text-destructive"
                  onClick={handleClear}
                  type="button"
                >
                  <TrashSimple size={11} weight="duotone" />
                  clear
                </button>
              </div>

              <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
                {entries.map((entry, index) => (
                  <HistoryRow
                    entry={entry}
                    key={`${entry.date}-${entry.wpm}-${index}`}
                  />
                ))}
              </div>
            </>
          )}
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

function SummaryStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-foreground/[0.03] px-2 py-3">
      <span className="font-bold font-mono text-foreground text-xl tabular-nums">
        {value}
        {suffix ? (
          <span className="text-muted-foreground/50 text-sm">{suffix}</span>
        ) : null}
      </span>
      <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

function HistoryRow({ entry }: { entry: TestHistoryEntry }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-foreground/[0.03]">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-xs">
          {entry.wpm}
          <span className="ml-0.5 text-[10px] text-muted-foreground/60">
            wpm
          </span>
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {entry.mode} {entry.modeDetail} · {formatRelative(entry.date)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground tabular-nums">
        <span>{entry.accuracy}% acc</span>
        <span className="text-muted-foreground/40">{entry.raw} raw</span>
      </div>
    </div>
  );
}
