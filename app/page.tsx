import { Suspense } from "react";
import { TypingPageShell } from "./typing-page-shell";

function TypingPageFallback() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-5xl flex-col items-center gap-3">
          {/* Toolbar shimmer */}
          <div className="h-11 w-full max-w-2xl animate-pulse rounded-full bg-foreground/[0.03]" />
          {/* Words area shimmer */}
          <div className="flex w-full flex-wrap gap-x-3 gap-y-2 mt-12 h-[7.8rem] overflow-hidden">
            {[72, 48, 56, 80, 40, 64, 52, 88, 44, 72, 60, 48, 76, 56, 68, 40, 84, 52, 64, 48, 72, 56, 44, 80, 60, 68, 52, 76].map((w, i) => (
              <div
                key={`s-${w}-${i}`}
                className="h-8 animate-pulse rounded bg-foreground/[0.05]"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
      </main>
      {/* Keyboard shimmer */}
      <footer className="hidden items-center justify-center lg:flex flex-col pb-4">
        <div className="scale-[0.85]">
          <div className="h-[265px] w-[860px] animate-pulse rounded-2xl bg-foreground/[0.03]" />
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<TypingPageFallback />}>
      <TypingPageShell />
    </Suspense>
  );
}
