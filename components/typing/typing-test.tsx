"use client";

import { ArrowsCounterClockwiseIcon, CursorIcon } from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { TestControls } from "@/components/typing/test-controls";
import { WordItem } from "@/components/typing/word-item";
import { useTypingTest } from "@/hooks/use-typing-test";
import { isRankedTopic } from "@/lib/topic-options";
import { cn } from "@/lib/utils";

// Lazy-loaded — chunk download is triggered when typing starts
const ResultsScreen = lazy(() =>
  import("@/components/typing/results").then((mod) => ({
    default: mod.ResultsScreen,
  }))
);

// Preload the results chunk (import() caches so this is idempotent)
const preloadResults = () => {
  import("@/components/typing/results");
};

interface TypingTestProps {
  onFinished?: (finished: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onKeyHighlight?: (key: string | null) => void;
  onTypingActiveChange?: (active: boolean) => void;
  pauseTypingInputRefocus?: boolean;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrator component
export function TypingTest(props: TypingTestProps) {
  const { liveStats, faahMode, ghostMode, caretStyle, topic } = useSettings();
  const faahAudioRef = useRef<HTMLAudioElement | null>(null);

  const onWrongKey = useCallback(() => {
    if (!faahMode) {
      return;
    }
    if (!faahAudioRef.current) {
      faahAudioRef.current = new Audio("/sounds/fahhhhh.mp3");
    }
    faahAudioRef.current.currentTime = 0;
    // biome-ignore lint/complexity/noVoid: fire-and-forget promise
    void faahAudioRef.current.play();
  }, [faahMode]);

  const {
    mode,
    timeOption,
    wordOption,
    quoteLength,
    punctuation,
    numbers,
    difficulty,
    words,
    typed,
    wordIndex,
    started,
    rowOffset,
    timeLeft,
    wordInputs,
    isFocused,
    resetting,
    isActivelyTyping,
    screenFade,
    wpm,
    accuracy,
    controlsVisible,
    showResults,
    frozenStats,
    submission,
    inputRef,
    wordsContainerRef,
    activeWordRef,
    handleKeyDown,
    handleNativeInput,
    handleCompositionStart,
    handleCompositionEnd,
    handleFocus,
    handleInputBlur,
    handleInputFocus,
    handleMouseMove,
    handleResultsRestart,
    handleResultsNext,
    onModeChange,
    onTimeOptionChange,
    onWordOptionChange,
    onQuoteLengthChange,
    onPunctuationToggle,
    onNumbersToggle,
    onDifficultyToggle,
    onRestart,
  } = useTypingTest({ ...props, onWrongKey, topic });

  // ── Debug overlay (opt-in via ?debug=true) ───────────────────────────────
  // Shows the raw InputEvent stream (inputType/data/value) + derived state.
  // Handy for diagnosing mobile soft-keyboard (Gboard) behaviour.
  const [debugEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "true"
  );
  const [dbgLog, setDbgLog] = useState<string[]>([]);
  const logDbg = useCallback(
    (line: string) => {
      if (!debugEnabled) {
        return;
      }
      setDbgLog((p) => [...p.slice(-11), line]);
    },
    [debugEnabled]
  );

  // Re-focus the hidden input on any keypress when it's blurred
  useEffect(() => {
    const handleGlobalKeyDown = () => {
      if (!isFocused && inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isFocused, inputRef]);

  // Preload results chunk when user starts typing
  useEffect(() => {
    if (started) {
      preloadResults();
    }
  }, [started]);

  if (showResults) {
    return (
      <div
        className="w-full transition-all duration-150 ease-out"
        style={{
          opacity: screenFade,
          filter: screenFade < 1 ? "blur(4px)" : "none",
        }}
      >
        <Suspense fallback={null}>
          <ResultsScreen
            onNext={handleResultsNext}
            onRestart={handleResultsRestart}
            stats={frozenStats!}
            submission={submission}
          />
        </Suspense>
      </div>
    );
  }

  let wordsOpacity = 0.15;
  if (resetting) {
    wordsOpacity = 0;
  } else if (isFocused) {
    wordsOpacity = 1;
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard focus handled via global keydown listener
    // biome-ignore lint/a11y/noStaticElementInteractions: intentional click-to-focus area
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: intentional click-to-focus area
    <div
      className="flex w-full max-w-5xl flex-col items-center gap-3 transition-all duration-150 ease-out"
      onClick={handleFocus}
      onMouseMove={handleMouseMove}
      style={{
        opacity: screenFade,
        filter: screenFade < 1 ? "blur(4px)" : "none",
      }}
    >
      {/* Debug overlay — only when ?debug=true */}
      {debugEnabled && (
        <div
          className="fixed top-12 left-1 z-[9999] max-w-[96vw] whitespace-pre-wrap break-all rounded bg-black/80 p-2 font-mono text-[9px] text-green-400 leading-tight"
          onClick={(e) => {
            e.stopPropagation();
            setDbgLog([]);
          }}
        >
          {`state: typed=${JSON.stringify(typed)} idx=${wordIndex} inputs=${JSON.stringify(wordInputs)}`}
          {"\n"}
          {dbgLog.join("\n") || "(tap to clear) raw input events"}
        </div>
      )}

      <TestControls
        controlsVisible={controlsVisible}
        difficulty={difficulty}
        mode={mode}
        numbers={numbers}
        onDifficultyToggle={onDifficultyToggle}
        onModeChange={onModeChange}
        onNumbersToggle={onNumbersToggle}
        onPunctuationToggle={onPunctuationToggle}
        onQuoteLengthChange={onQuoteLengthChange}
        onRestart={onRestart}
        onTimeOptionChange={onTimeOptionChange}
        onWordOptionChange={onWordOptionChange}
        punctuation={punctuation}
        quoteLength={quoteLength}
        showModifiers={isRankedTopic(topic)}
        timeOption={timeOption}
        wordOption={wordOption}
      />

      {/* Words display */}
      <div className="relative w-full">
        {/* Live stats bar */}
        <motion.div
          animate={{ opacity: resetting ? 0 : 1 }}
          className="mb-4 flex min-h-8 items-center justify-between"
          transition={{ duration: 0.15 }}
        >
          {/* Right-aligned live stats */}
          <div className="flex-1" />
          <div
            className={cn(
              "flex items-baseline gap-6 transition-opacity duration-200",
              started ? "opacity-100" : "opacity-0"
            )}
          >
            {/* Timer / progress */}
            {mode === "time" && (
              <span className="tabular-nums">
                <span className="font-bold text-foreground text-lg">
                  {timeLeft}
                </span>
                <span className="ml-0.5 text-muted-foreground text-xs">s</span>
              </span>
            )}
            {mode === "words" && (
              <span className="tabular-nums">
                <span className="font-bold text-foreground text-lg">
                  {wordIndex}
                </span>
                <span className="text-muted-foreground text-xs">
                  /{wordOption}
                </span>
              </span>
            )}

            {/* WPM + Accuracy — gated by liveStats setting */}
            {liveStats && (
              <>
                <span className="tabular-nums">
                  <span className="font-bold text-foreground text-lg">
                    {wpm}
                  </span>
                  <span className="ml-0.5 text-muted-foreground text-xs">
                    wpm
                  </span>
                </span>
                <span className="tabular-nums">
                  <span className="font-bold text-foreground text-lg">
                    {accuracy}
                  </span>
                  <span className="text-muted-foreground text-xs">% acc</span>
                </span>
              </>
            )}
          </div>
        </motion.div>

        <div
          className={cn(
            "relative h-[7.8rem] w-full overflow-hidden text-2xl leading-relaxed",
            isActivelyTyping && "is-typing"
          )}
          ref={wordsContainerRef}
          style={{ fontFamily: "var(--typing-font)" }}
        >
          <input
            aria-label="Type here"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            autoFocus
            className="absolute h-0 w-0 opacity-0"
            data-gramm="false"
            inputMode="text"
            onBeforeInput={(e) => {
              const ne = e.nativeEvent as InputEvent;
              logDbg(`before t=${ne.inputType} d=${JSON.stringify(ne.data)}`);
            }}
            onBlur={handleInputBlur}
            onChange={(e) => {
              const ne = e.nativeEvent as InputEvent;
              logDbg(
                `chg t=${ne.inputType ?? "?"} d=${JSON.stringify(ne.data)} v=${JSON.stringify(e.target.value)}`
              );
              handleNativeInput(ne.inputType, ne.data);
            }}
            onCompositionEnd={(e) => {
              logDbg(
                `compEnd d=${JSON.stringify(e.data)} v=${JSON.stringify(e.currentTarget.value)}`
              );
              handleCompositionEnd(e);
            }}
            onCompositionStart={() => {
              logDbg("compStart");
              handleCompositionStart();
            }}
            onCompositionUpdate={(e) =>
              logDbg(`compUpd d=${JSON.stringify(e.data)}`)
            }
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            spellCheck={false}
            tabIndex={-1}
          />

          <LayoutGroup id="words">
            <motion.div
              animate={{
                y: -rowOffset,
                opacity: wordsOpacity,
                filter: resetting ? "blur(4px)" : "blur(0px)",
              }}
              className="flex flex-wrap gap-x-2.5 gap-y-1"
              transition={
                resetting
                  ? { duration: 0.15, ease: "easeOut" }
                  : { type: "spring", stiffness: 300, damping: 30, mass: 0.8 }
              }
            >
              {words.length === 0 ? (
                <WordsSkeleton />
              ) : (
                words.map((word, wIdx) => {
                  const isActive = wIdx === wordIndex;
                  const isPast = wIdx < wordIndex;
                  const isFuture = !(isActive || isPast);
                  let displayInput = "";
                  if (isActive) {
                    displayInput = typed;
                  } else if (isPast) {
                    displayInput = wordInputs[wIdx] ?? "";
                  }
                  const hasError = isPast && wordInputs[wIdx] !== word;
                  const currentWordDone =
                    typed.length >= (words[wordIndex]?.length ?? 0);
                  const isNextWord = wIdx === wordIndex + 1;
                  const dimmed =
                    ghostMode &&
                    isFocused &&
                    isFuture &&
                    !(currentWordDone && isNextWord);

                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: word+index combo ensures uniqueness for duplicate words
                    <WordItem
                      caretStyle={caretStyle}
                      dimmed={dimmed}
                      displayInput={displayInput}
                      elemRef={isActive ? activeWordRef : undefined}
                      hasError={hasError}
                      isActive={isActive}
                      isPast={isPast}
                      key={`${word}-${wIdx}`}
                      word={word}
                    />
                  );
                })
              )}
            </motion.div>
          </LayoutGroup>
          {/* Unfocused: blur overlay with prompt */}
          <AnimatePresence>
            {!isFocused && (
              <motion.div
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-3 backdrop-blur-[3px]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="focus-overlay"
                onClick={() => inputRef.current?.focus()}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-xs backdrop-blur-sm">
                  <CursorIcon
                    className="text-muted-foreground/60"
                    size={14}
                    weight="duotone"
                  />
                  <span>Click or press any key to focus</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Restart button */}
      <RestartButton controlsVisible={controlsVisible} onRestart={onRestart} />

      {/* Keyboard shortcuts hint */}
      <motion.div
        animate={{
          // biome-ignore lint/style/noNestedTernary: readable conditional
          opacity: mode === "zen" && started ? 1 : controlsVisible ? 1 : 0,
        }}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50"
        transition={{ duration: 0.4 }}
      >
        {mode === "zen" && started ? (
          <>
            <kbd className="rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              shift
            </kbd>
            <span className="text-muted-foreground/30">+</span>
            <kbd className="rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              enter
            </kbd>
            <span className="ml-0.5">end test</span>
          </>
        ) : (
          <>
            <kbd className="rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              tab
            </kbd>
            <span className="text-muted-foreground/30">+</span>
            <kbd className="rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              enter
            </kbd>
            <span className="ml-0.5">restart</span>
          </>
        )}
      </motion.div>
    </div>
  );
}

// Lightweight placeholder shown while the (server-signed) word list loads, so
// the first paint isn't a blank gap. Deterministic widths to avoid layout jitter.
const SKELETON_WIDTHS = [
  "3.5rem",
  "5rem",
  "2.5rem",
  "4.25rem",
  "3rem",
  "5.5rem",
  "2.75rem",
  "4rem",
  "3.25rem",
  "4.75rem",
  "2.5rem",
  "3.75rem",
  "5.25rem",
  "3rem",
  "4.5rem",
  "2.75rem",
  "5rem",
  "3.5rem",
  "4rem",
  "2.5rem",
  "4.75rem",
  "3.25rem",
  "2.75rem",
  "4rem",
  "3.25rem",
  "4.75rem",
  "2.5rem",
  "3.75rem",
  "5.25rem",
  "3rem",
  "4.5rem",
];

function WordsSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-wrap gap-x-2.5 gap-y-2"
      // biome-ignore lint/a11y/useSemanticElements: purely decorative loading placeholder
      role="presentation"
    >
      {SKELETON_WIDTHS.map((w, i) => (
        <span
          className="inline-block h-[1.4em] animate-pulse rounded bg-foreground/10"
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative list
          key={i}
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

function RestartButton({
  controlsVisible,
  onRestart,
}: {
  controlsVisible: boolean;
  onRestart: () => void;
}) {
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    onRestart();
  }

  return (
    <motion.button
      animate={{ opacity: controlsVisible ? 1 : 0.15 }}
      className={cn(
        "rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground",
        !controlsVisible && "pointer-events-none"
      )}
      onClick={handleClick}
      title="Restart test"
      transition={{ duration: 0.4 }}
    >
      <span
        style={{
          display: "inline-flex",
          transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
          transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
        }}
      >
        <ArrowsCounterClockwiseIcon size={18} />
      </span>
    </motion.button>
  );
}
