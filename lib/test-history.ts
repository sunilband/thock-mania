// Local test-history log. Each completed (valid) test appends one entry so the
// user can review their recent runs and aggregate stats — all client-side, no
// account required. Stored under a single localStorage key as a JSON array.

const HISTORY_KEY = "kz-history";
const MAX_ENTRIES = 100;

export interface TestHistoryEntry {
  accuracy: number;
  consistency: number;
  /** ISO timestamp of when the test finished. */
  date: string;
  mode: string;
  modeDetail: string;
  raw: number;
  wpm: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getTestHistory(): TestHistoryEntry[] {
  if (!isBrowser()) {
    return [];
  }
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TestHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addTestToHistory(entry: TestHistoryEntry): TestHistoryEntry[] {
  if (!isBrowser()) {
    return [];
  }
  // Newest first, capped so localStorage never grows unbounded.
  const next = [entry, ...getTestHistory()].slice(0, MAX_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearTestHistory(): void {
  if (!isBrowser()) {
    return;
  }
  localStorage.removeItem(HISTORY_KEY);
}

export interface HistorySummary {
  averageAccuracy: number;
  averageWpm: number;
  bestWpm: number;
  count: number;
}

export function summarizeHistory(entries: TestHistoryEntry[]): HistorySummary {
  if (entries.length === 0) {
    return { averageAccuracy: 0, averageWpm: 0, bestWpm: 0, count: 0 };
  }
  const totalWpm = entries.reduce((sum, e) => sum + e.wpm, 0);
  const totalAcc = entries.reduce((sum, e) => sum + e.accuracy, 0);
  const bestWpm = entries.reduce((best, e) => Math.max(best, e.wpm), 0);
  return {
    averageWpm: Math.round(totalWpm / entries.length),
    averageAccuracy: Math.round(totalAcc / entries.length),
    bestWpm,
    count: entries.length,
  };
}
