"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useState } from "react";

const VISITED_KEY = "kz-visited";

export function VisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem(VISITED_KEY);

    if (hasVisited) {
      // Already counted this session — just fetch current count
      fetch("/api/visitor-count")
        .then((res) => res.json())
        .then((data) => setCount(data.count))
        .catch(() => {
          /* network error — ignore silently */
        });
    } else {
      // First visit this session — increment
      fetch("/api/visitor-count", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          setCount(data.count);
          sessionStorage.setItem(VISITED_KEY, "1");
        })
        .catch(() => {
          /* network error — ignore silently */
        });
    }
  }, []);

  if (count === null || count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
      <NumberFlow
        className="font-medium font-mono text-muted-foreground/80 tabular-nums"
        format={{ notation: "compact" }}
        value={count}
      />
      <span>thocks and counting</span>
    </div>
  );
}
