"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLanguageWords } from "@/lib/languages";
import { getQuote, type QuoteLength } from "@/lib/quotes";
import {
  DIFFICULTY_STORAGE_KEY,
  NUMBERS_STORAGE_KEY,
  PUNCTUATION_STORAGE_KEY,
  QUOTE_LENGTH_STORAGE_KEY,
  readStoredBool,
  readStoredDifficulty,
  readStoredQuoteLength,
  readStoredTestMode,
  readStoredTimeOption,
  readStoredWordOption,
  TEST_MODE_STORAGE_KEY,
  type TestMode,
  TIME_OPTION_STORAGE_KEY,
  type TimeOption,
  WORD_OPTION_STORAGE_KEY,
  type WordOption,
} from "@/lib/test-storage";
import type { ResultStats, WpmSnapshot } from "@/lib/types";
import {
  type Difficulty,
  generateWords,
  generateWordsFromPool,
} from "@/lib/words";
import {
  accuracyFromCounts,
  countWpm,
  wpmNumeratorFromCounts,
} from "@/lib/wpm-count";

type ResetOverrides = Partial<{
  mode: TestMode;
  quoteLength: QuoteLength;
  wordOption: WordOption;
  timeOption: TimeOption;
  punctuation: boolean;
  numbers: boolean;
  difficulty: Difficulty | undefined;
}>;

interface UseTypingTestProps {
  onFinished?: (finished: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
  onKeyHighlight?: (key: string | null) => void;
  onTypingActiveChange?: (active: boolean) => void;
  onWrongKey?: () => void;
  pauseTypingInputRefocus?: boolean;
}

export function useTypingTest({
  onKeyHighlight,
  onFinished,
  onTypingActiveChange,
  onFocusChange,
  onWrongKey,
  pauseTypingInputRefocus = false,
}: UseTypingTestProps) {
  const pauseRefocusRef = useRef(false);
  pauseRefocusRef.current = pauseTypingInputRefocus;

  // ── Options state ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<TestMode>("time");
  const [timeOption, setTimeOption] = useState<TimeOption>(30);
  const [wordOption, setWordOption] = useState<WordOption>(25);
  const [quoteLength, setQuoteLength] = useState<QuoteLength>("medium");
  const [quoteAuthor, setQuoteAuthor] = useState<string | null>(null);
  const [punctuation, setPunctuation] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>("easy");

  // Word pool cache (kept in a ref so it survives re-renders)
  const wordPoolRef = useRef<{
    hard: boolean;
    words: string[];
  } | null>(null);

  // ── Test state ───────────────────────────────────────────────────────────
  const [words, setWords] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [rowOffset, setRowOffset] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wordInputs, setWordInputs] = useState<string[]>([]);
  const [wpmHistory, setWpmHistory] = useState<WpmSnapshot[]>([]);
  const [showControls, setShowControls] = useState(true);
  const [isFocused, setIsFocused] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const [screenFade, setScreenFade] = useState(1);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const correctCharsRef = useRef(0);
  // Synchronous mirrors of typed/wordIndex/wordInputs. State updates are async,
  // so when one input event delivers several characters (swipe, autocorrect,
  // paste) the per-character processors must read/write these refs to stay
  // consistent within a single event.
  const typedRef = useRef("");
  const wordIndexRef = useRef(0);
  const wordInputsRef = useRef<string[]>([]);
  const allTypedRef = useRef(0);
  const errorsThisSecondRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const correctedErrorsRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabPressedRef = useRef(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTestRef = useRef<(() => void) | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const mtCounts = useMemo(
    () =>
      countWpm({
        targetWords: words,
        wordInputs,
        typed,
        wordIndex,
        mode,
        final: finished,
      }),
    [words, wordInputs, typed, wordIndex, mode, finished]
  );
  const wpmNumerator = wpmNumeratorFromCounts(mtCounts);
  const accuracy = accuracyFromCounts(mtCounts);
  correctCharsRef.current = wpmNumerator;

  // Mirror committed state into refs each render so the synchronous,
  // per-character processors always start from the latest baseline.
  typedRef.current = typed;
  wordIndexRef.current = wordIndex;
  wordInputsRef.current = wordInputs;

  // Rule 1: derive realtime WPM inline — re-computed on every render triggered
  // by a keystroke (typed changes → re-render), no useEffect needed.
  const wpm =
    started && startTime && !finished
      ? Math.round(
          wpmNumerator /
            5 /
            Math.max((Date.now() - startTime) / 1000 / 60, 1 / 60)
        )
      : 0;

  // ── finishTest ───────────────────────────────────────────────────────────
  // Rule 3: all finish-related side effects run here, not in reactive effects.
  const finishTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setFinished(true);
    setShowControls(true);
    onFinished?.(true);
    onTypingActiveChange?.(false);
    setScreenFade(0);
    requestAnimationFrame(() => setScreenFade(1));
  }, [onFinished, onTypingActiveChange]);

  finishTestRef.current = finishTest;

  // ── buildWords: generate words from English pool or fallback ──────────
  const buildWords = useCallback(
    async (
      count: number,
      opts: {
        punctuation: boolean;
        numbers: boolean;
        difficulty: Difficulty | undefined;
      }
    ): Promise<string[]> => {
      const isHard = opts.difficulty === "hard";
      // Use cached pool if same difficulty tier
      if (wordPoolRef.current && wordPoolRef.current.hard === isHard) {
        return generateWordsFromPool(wordPoolRef.current.words, count, opts);
      }
      const pool = await fetchLanguageWords(isHard);
      if (pool.length > 0) {
        wordPoolRef.current = { hard: isHard, words: pool };
        return generateWordsFromPool(pool, count, opts);
      }
      // Fallback to random-words if fetch fails
      return generateWords(count, opts);
    },
    []
  );

  // ── resetTestWith ────────────────────────────────────────────────────────
  // Rule 3: accepts explicit overrides so option-change handlers can reset
  // immediately with the new value without waiting for state to commit.
  const resetTestWith = useCallback(
    async (overrides: ResetOverrides = {}) => {
      const m = overrides.mode ?? mode;
      const ql = overrides.quoteLength ?? quoteLength;
      const wo = overrides.wordOption ?? wordOption;
      const to = overrides.timeOption ?? timeOption;
      const p = overrides.punctuation ?? punctuation;
      const n = overrides.numbers ?? numbers;
      const d = "difficulty" in overrides ? overrides.difficulty : difficulty;
      const wc = m === "time" ? 200 : m === "words" ? wo : 100;

      setQuoteAuthor(null);
      if (m === "quote") {
        const { words: newWords, author } = getQuote(ql);
        setWords(newWords);
        setQuoteAuthor(author);
      } else {
        const newWords = await buildWords(wc, {
          punctuation: p,
          numbers: n,
          difficulty: d,
        });
        setWords(newWords);
      }
      setTyped("");
      setWordIndex(0);
      setStarted(false);
      setFinished(false);
      setStartTime(null);
      setWordInputs([]);
      setWpmHistory([]);
      typedRef.current = "";
      wordIndexRef.current = 0;
      wordInputsRef.current = [];
      correctCharsRef.current = 0;
      allTypedRef.current = 0;
      errorsThisSecondRef.current = 0;
      elapsedSecondsRef.current = 0;
      correctedErrorsRef.current = 0;
      if (m === "time") {
        setTimeLeft(to);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRowOffset(0);
      setShowControls(true);
      setIsActivelyTyping(false);
      onFinished?.(false);
      onTypingActiveChange?.(false);
      inputRef.current?.focus();
    },
    [
      mode,
      quoteLength,
      wordOption,
      timeOption,
      punctuation,
      numbers,
      difficulty,
      buildWords,
      onFinished,
      onTypingActiveChange,
    ]
  );

  const resetTestImmediate = useCallback(
    () => resetTestWith(),
    [resetTestWith]
  );

  const resetTest = useCallback(
    (overrides: ResetOverrides = {}) => {
      if (resetAnimRef.current) {
        clearTimeout(resetAnimRef.current);
      }
      setResetting(true);
      resetAnimRef.current = setTimeout(() => {
        void resetTestWith(overrides).then(() => {
          setResetting(false);
          resetAnimRef.current = null;
        });
      }, 150);
    },
    [resetTestWith]
  );

  // One-time mount — read persisted options and build the first word set.
  useEffect(() => {
    const storedMode = readStoredTestMode();
    const storedTime = readStoredTimeOption();
    const storedWordOption = readStoredWordOption();
    const storedQuoteLength = readStoredQuoteLength();
    const storedPunctuation = readStoredBool(PUNCTUATION_STORAGE_KEY);
    const storedNumbers = readStoredBool(NUMBERS_STORAGE_KEY);
    const storedDifficulty = readStoredDifficulty();

    const m = storedMode ?? mode;
    const to = storedTime ?? timeOption;
    const wo = storedWordOption ?? wordOption;
    const ql = storedQuoteLength ?? quoteLength;
    const p = storedPunctuation ?? punctuation;
    const n = storedNumbers ?? numbers;
    const d = storedDifficulty === undefined ? difficulty : storedDifficulty;

    if (storedMode !== undefined) {
      setMode(storedMode);
    }
    if (storedTime !== undefined) {
      setTimeOption(storedTime);
    }
    if (storedWordOption !== undefined) {
      setWordOption(storedWordOption);
    }
    if (storedQuoteLength !== undefined) {
      setQuoteLength(storedQuoteLength);
    }
    if (storedPunctuation !== undefined) {
      setPunctuation(storedPunctuation);
    }
    if (storedNumbers !== undefined) {
      setNumbers(storedNumbers);
    }
    if (storedDifficulty !== undefined) {
      setDifficulty(storedDifficulty);
    }

    const wc = m === "time" ? 200 : m === "words" ? wo : 100;
    if (m === "quote") {
      const { words: initWords, author } = getQuote(ql);
      setWords(initWords);
      setQuoteAuthor(author);
    } else {
      buildWords(wc, {
        punctuation: p,
        numbers: n,
        difficulty: d,
      }).then((w) => setWords(w));
    }
    if (m === "time") {
      setTimeLeft(to);
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helper callbacks ─────────────────────────────────────────────────────
  const markTypingActive = useCallback(() => {
    setIsActivelyTyping(true);
    if (typingIdleRef.current) {
      clearTimeout(typingIdleRef.current);
    }
    typingIdleRef.current = setTimeout(() => setIsActivelyTyping(false), 1000);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!started || finished) {
      return;
    }
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500);
  }, [started, finished]);

  const recordWordSnapshot = useCallback(
    (
      snapshotWordInputs: string[],
      snapshotTyped: string,
      snapshotWordIndex: number
    ) => {
      if (!startTime || mode === "time") {
        return;
      }
      const snapCounts = countWpm({
        targetWords: words,
        wordInputs: snapshotWordInputs,
        typed: snapshotTyped,
        wordIndex: snapshotWordIndex,
        mode,
        final: false,
      });
      const snapNum = wpmNumeratorFromCounts(snapCounts);
      const elapsedSec = (Date.now() - startTime) / 1000;
      elapsedSecondsRef.current = elapsedSec;
      const elapsedMin = elapsedSec / 60 || 1 / 60;
      const snapWpm = Math.round(snapNum / 5 / elapsedMin);
      const snapRaw = Math.max(
        Math.round(allTypedRef.current / 5 / elapsedMin),
        snapWpm
      );
      setWpmHistory((prev) => [
        ...prev,
        {
          second: Math.round(elapsedSec),
          wpm: snapWpm,
          raw: snapRaw,
          errors: errorsThisSecondRef.current,
        },
      ]);
      errorsThisSecondRef.current = 0;
    },
    [startTime, mode, words]
  );

  const clearWordOrNavigateBack = useCallback(() => {
    const idx = wordIndexRef.current;
    if (typedRef.current.length > 0) {
      typedRef.current = "";
      setTyped("");
      const cw = words[idx];
      onKeyHighlight?.(cw && cw.length > 0 ? cw[0] : null);
      return;
    }
    if (idx <= 0) {
      return;
    }
    const prevInput = wordInputsRef.current[idx - 1] ?? "";
    const prevWord = words[idx - 1];
    wordIndexRef.current = idx - 1;
    typedRef.current = prevInput;
    wordInputsRef.current = wordInputsRef.current.slice(0, -1);
    setWordIndex(idx - 1);
    setTyped(prevInput);
    setWordInputs((prev) => prev.slice(0, -1));
    if (prevInput.length < prevWord.length) {
      onKeyHighlight?.(prevWord[prevInput.length]);
    } else {
      onKeyHighlight?.(" ");
    }
  }, [words, onKeyHighlight]);

  // Start the test (and the countdown timer for "time" mode). Safe to call on
  // every keystroke — it no-ops once already started.
  const ensureStarted = useCallback(() => {
    if (started) {
      return;
    }
    setStarted(true);
    setStartTime(Date.now());
    setShowControls(false);
    onTypingActiveChange?.(true);

    if (mode === "time") {
      let elapsedTicks = 0;
      timerRef.current = setInterval(() => {
        elapsedTicks += 1;
        elapsedSecondsRef.current = elapsedTicks;
        const elapsedMin = elapsedTicks / 60;
        const snapWpm =
          elapsedMin > 0
            ? Math.round(correctCharsRef.current / 5 / elapsedMin)
            : 0;
        const snapRaw =
          elapsedMin > 0
            ? Math.max(
                Math.round(allTypedRef.current / 5 / elapsedMin),
                snapWpm
              )
            : 0;
        setWpmHistory((prev) => [
          ...prev,
          {
            second: elapsedTicks,
            wpm: snapWpm,
            raw: snapRaw,
            errors: errorsThisSecondRef.current,
          },
        ]);
        errorsThisSecondRef.current = 0;
        if (elapsedTicks >= timeOption) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          finishTestRef.current?.();
        } else {
          setTimeLeft(timeOption - elapsedTicks);
        }
      }, 1000);
    }
  }, [started, mode, timeOption, onTypingActiveChange]);

  // ── Core input processing (ref-driven so multiple chars in one input event
  // stay consistent before React commits state) ─────────────────────────────
  const processSpace = useCallback(() => {
    const idx = wordIndexRef.current;
    const currentTyped = typedRef.current;
    const currentWord = words[idx];
    if (currentTyped.length === 0) {
      return;
    }

    allTypedRef.current += 1; // count the space keystroke so raw >= wpm

    for (
      let i = 0;
      i < Math.min(currentTyped.length, currentWord.length);
      i++
    ) {
      if (currentTyped[i] !== currentWord[i]) {
        errorsThisSecondRef.current++;
      }
    }
    if (currentTyped.length > currentWord.length) {
      errorsThisSecondRef.current++;
    }

    const nextInputs = [...wordInputsRef.current, currentTyped];
    const nextIndex = idx + 1;
    recordWordSnapshot(nextInputs, "", nextIndex);

    wordInputsRef.current = nextInputs;
    setWordInputs(nextInputs);

    if (idx + 1 >= words.length) {
      finishTest();
      return;
    }
    wordIndexRef.current = nextIndex;
    typedRef.current = "";
    setWordIndex(nextIndex);
    setTyped("");
    onKeyHighlight?.(null);
    requestAnimationFrame(() => {
      if (!activeWordRef.current) {
        return;
      }
      const word = activeWordRef.current;
      const lineH = word.offsetHeight + 4;
      const row = Math.round(word.offsetTop / lineH);
      setRowOffset(Math.max(0, row - 1) * lineH);
    });
  }, [words, recordWordSnapshot, finishTest, onKeyHighlight]);

  const processBackspace = useCallback(() => {
    const idx = wordIndexRef.current;
    const currentTyped = typedRef.current;
    const currentWord = words[idx];
    if (currentTyped.length === 0 && idx > 0) {
      const prevInput = wordInputsRef.current[idx - 1] ?? "";
      wordIndexRef.current = idx - 1;
      typedRef.current = prevInput;
      wordInputsRef.current = wordInputsRef.current.slice(0, -1);
      setWordIndex(idx - 1);
      setTyped(prevInput);
      setWordInputs((prev) => prev.slice(0, -1));
    } else if (currentTyped.length > 0) {
      const lastIdx = currentTyped.length - 1;
      const isWrong =
        lastIdx >= currentWord.length ||
        currentTyped[lastIdx] !== currentWord[lastIdx];
      if (isWrong) {
        correctedErrorsRef.current += 1;
      }
      const nextTyped = currentTyped.slice(0, -1);
      typedRef.current = nextTyped;
      setTyped(nextTyped);
    }
  }, [words]);

  const processChar = useCallback(
    (char: string) => {
      const idx = wordIndexRef.current;
      const currentTyped = typedRef.current;
      const currentWord = words[idx];
      allTypedRef.current += 1;
      const nextTyped = currentTyped + char;
      typedRef.current = nextTyped;
      setTyped(nextTyped);

      const charIndex = currentTyped.length;
      const isWrong =
        charIndex >= currentWord.length || char !== currentWord[charIndex];
      if (isWrong) {
        onWrongKey?.();
      }

      const isLastWord = idx + 1 >= words.length;
      if (
        isLastWord &&
        nextTyped.length >= currentWord.length &&
        mode !== "time" &&
        mode !== "zen"
      ) {
        for (
          let i = 0;
          i < Math.min(nextTyped.length, currentWord.length);
          i++
        ) {
          if (nextTyped[i] !== currentWord[i]) {
            errorsThisSecondRef.current++;
          }
        }
        if (nextTyped.length > currentWord.length) {
          errorsThisSecondRef.current++;
        }
        const nextInputs = [...wordInputsRef.current, nextTyped];
        wordInputsRef.current = nextInputs;
        setWordInputs(nextInputs);
        recordWordSnapshot(nextInputs, "", idx + 1);
        finishTest();
        return;
      }

      const nextCharIndex = nextTyped.length;
      onKeyHighlight?.(
        nextCharIndex < currentWord.length ? currentWord[nextCharIndex] : " "
      );
    },
    [words, mode, recordWordSnapshot, finishTest, onKeyHighlight, onWrongKey]
  );

  // Feed a single character or control token into the test. Returns true if
  // the input was consumed (used to start the test / mark activity).
  const handleTypedInput = useCallback(
    (input: string) => {
      if (finished) {
        return;
      }
      ensureStarted();
      markTypingActive();
      if (input === " ") {
        processSpace();
      } else if (input === "Backspace") {
        processBackspace();
      } else if (input.length === 1) {
        processChar(input);
      }
    },
    [
      finished,
      ensureStarted,
      markTypingActive,
      processSpace,
      processBackspace,
      processChar,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const isAltWordDelete =
        e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        (e.key === "Backspace" || e.key === "Delete");
      const isCtrlBackspaceWordNav =
        e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey &&
        e.key === "Backspace";

      if (isAltWordDelete || isCtrlBackspaceWordNav) {
        e.preventDefault();
        if (finished) {
          return;
        }
        ensureStarted();
        markTypingActive();
        clearWordOrNavigateBack();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        tabPressedRef.current = true;
        setTimeout(() => {
          tabPressedRef.current = false;
        }, 1000);
        return;
      }
      if (e.key === "Enter" && tabPressedRef.current) {
        e.preventDefault();
        tabPressedRef.current = false;
        resetTest();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        if (mode === "zen" && started && !finished) {
          finishTest();
        }
        return;
      }

      if (finished) {
        return;
      }

      // Backspace at the start of a word produces no value change, so the
      // input event never fires — handle the cross-word navigation here.
      // (All other character entry and in-word deletion is handled by the
      // input event in handleInputChange, which works on every platform
      // including mobile soft keyboards.)
      if (
        e.key === "Backspace" &&
        typedRef.current.length === 0 &&
        wordIndexRef.current > 0
      ) {
        ensureStarted();
        markTypingActive();
        processBackspace();
      }
    },
    [
      finished,
      started,
      mode,
      resetTest,
      finishTest,
      ensureStarted,
      markTypingActive,
      clearWordOrNavigateBack,
      processBackspace,
    ]
  );

  const composingRef = useRef(false);

  // Single source of truth for character entry and in-word deletion. Driven by
  // the input element's value (native `input` event), which fires reliably on
  // desktop and all mobile soft keyboards (Gboard, iOS, etc.). We diff the new
  // value against the current `typed` to determine what changed.
  const handleInputChange = useCallback(
    (value: string) => {
      if (finished || composingRef.current) {
        return;
      }

      // Longest common prefix between the new value and what we already have.
      const current = typedRef.current;
      let cp = 0;
      const minLen = Math.min(value.length, current.length);
      while (cp < minLen && value[cp] === current[cp]) {
        cp++;
      }

      const deletions = current.length - cp;
      const added = value.slice(cp);
      if (deletions === 0 && added.length === 0) {
        return;
      }

      ensureStarted();
      markTypingActive();

      for (let i = 0; i < deletions; i++) {
        processBackspace();
      }
      for (const char of added) {
        handleTypedInput(char);
      }
    },
    [
      finished,
      ensureStarted,
      markTypingActive,
      processBackspace,
      handleTypedInput,
    ]
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      handleInputChange(e.currentTarget.value);
    },
    [handleInputChange]
  );

  const handleFocus = () => {
    if (pauseRefocusRef.current) {
      return;
    }
    inputRef.current?.focus();
  };

  const handleInputBlur = useCallback(() => {
    if (pauseRefocusRef.current) {
      return;
    }
    setIsFocused(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
    onFocusChange?.(true);
  }, [onFocusChange]);

  // ── Frozen stats (computed inline, not via effect) ────────────────────────
  const frozenStatsRef = useRef<ResultStats | null>(null);

  if (finished && !frozenStatsRef.current) {
    const elapsed = startTime
      ? (Date.now() - startTime) / 1000
      : elapsedSecondsRef.current;
    const elapsedMin = elapsed / 60 || 1 / 60;
    const wpmValues = wpmHistory.map((s) => s.wpm).filter((v) => v > 0);
    let consistency = 100;
    if (wpmValues.length > 1) {
      const mean = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
      const variance =
        wpmValues.reduce((a, b) => a + (b - mean) ** 2, 0) / wpmValues.length;
      consistency = Math.max(
        0,
        Math.round(100 - (Math.sqrt(variance) / (mean || 1)) * 100)
      );
    }
    const computedWpm = Math.round(wpmNumerator / 5 / elapsedMin);
    const computedRaw = Math.max(
      Math.round(allTypedRef.current / 5 / elapsedMin),
      computedWpm
    );
    frozenStatsRef.current = {
      wpm: computedWpm,
      accuracy,
      raw: computedRaw,
      correctChars: mtCounts.correctWordChars,
      incorrectChars: mtCounts.incorrectChars,
      extraChars: mtCounts.extraChars,
      missedChars: mtCounts.missedChars,
      consistency,
      elapsedSeconds: Math.round(elapsed),
      correctedErrors: correctedErrorsRef.current,
      mode,
      modeDetail:
        mode === "time"
          ? String(timeOption)
          : mode === "words"
            ? String(wordOption)
            : mode === "quote"
              ? quoteLength
              : "",
      wpmHistory,
    };
  }
  if (!finished) {
    frozenStatsRef.current = null;
  }

  // Resets all typing state but keeps the current word list (for "restart same test").
  const resetSameWords = useCallback(() => {
    setTyped("");
    setWordIndex(0);
    setStarted(false);
    setFinished(false);
    setStartTime(null);
    setWordInputs([]);
    setWpmHistory([]);
    typedRef.current = "";
    wordIndexRef.current = 0;
    wordInputsRef.current = [];
    correctCharsRef.current = 0;
    allTypedRef.current = 0;
    errorsThisSecondRef.current = 0;
    elapsedSecondsRef.current = 0;
    correctedErrorsRef.current = 0;
    if (mode === "time") {
      setTimeLeft(timeOption);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRowOffset(0);
    setShowControls(true);
    setIsActivelyTyping(false);
    onFinished?.(false);
    onTypingActiveChange?.(false);
    inputRef.current?.focus();
  }, [mode, timeOption, onFinished, onTypingActiveChange]);

  // Rule 3: fade results→typing on restart, driven by user action.
  const handleResultsRestart = useCallback(() => {
    setScreenFade(0);
    if (screenFadeRef.current) {
      clearTimeout(screenFadeRef.current);
    }
    screenFadeRef.current = setTimeout(() => {
      setResetting(true);
      resetSameWords();
      setTimeout(() => setResetting(false), 150);
      requestAnimationFrame(() => setScreenFade(1));
      screenFadeRef.current = null;
    }, 150);
  }, [resetSameWords]);

  const handleResultsNext = useCallback(() => {
    setScreenFade(0);
    if (screenFadeRef.current) {
      clearTimeout(screenFadeRef.current);
    }
    screenFadeRef.current = setTimeout(() => {
      void resetTestImmediate().then(() => {
        requestAnimationFrame(() => setScreenFade(1));
        screenFadeRef.current = null;
      });
    }, 150);
  }, [resetTestImmediate]);

  // ── Option-change handlers (Rule 3) ──────────────────────────────────────
  const onModeChange = useCallback(
    (next: TestMode) => {
      setMode(next);
      localStorage.setItem(TEST_MODE_STORAGE_KEY, next);
      resetTest({ mode: next });
    },
    [resetTest]
  );

  const onTimeOptionChange = useCallback(
    (next: TimeOption) => {
      setTimeOption(next);
      localStorage.setItem(TIME_OPTION_STORAGE_KEY, String(next));
      resetTest({ timeOption: next });
    },
    [resetTest]
  );

  const onWordOptionChange = useCallback(
    (next: WordOption) => {
      setWordOption(next);
      localStorage.setItem(WORD_OPTION_STORAGE_KEY, String(next));
      resetTest({ wordOption: next });
    },
    [resetTest]
  );

  const onQuoteLengthChange = useCallback(
    (next: QuoteLength) => {
      setQuoteLength(next);
      localStorage.setItem(QUOTE_LENGTH_STORAGE_KEY, next);
      resetTest({ quoteLength: next });
    },
    [resetTest]
  );

  const onPunctuationToggle = useCallback(() => {
    const next = !punctuation;
    setPunctuation(next);
    localStorage.setItem(PUNCTUATION_STORAGE_KEY, String(next));
    resetTest({ punctuation: next });
  }, [punctuation, resetTest]);

  const onNumbersToggle = useCallback(() => {
    const next = !numbers;
    setNumbers(next);
    localStorage.setItem(NUMBERS_STORAGE_KEY, String(next));
    resetTest({ numbers: next });
  }, [numbers, resetTest]);

  const onDifficultyToggle = useCallback(
    (d: Difficulty) => {
      const next = difficulty === d ? undefined : d;
      setDifficulty(next);
      if (next) {
        localStorage.setItem(DIFFICULTY_STORAGE_KEY, next);
      } else {
        localStorage.removeItem(DIFFICULTY_STORAGE_KEY);
      }
      resetTest({ difficulty: next });
    },
    [difficulty, resetTest]
  );

  const controlsVisible = !started || showControls;
  const showResults = finished && frozenStatsRef.current;

  return {
    // State
    mode,
    timeOption,
    wordOption,
    quoteLength,
    quoteAuthor,
    punctuation,
    numbers,
    difficulty,
    words,
    typed,
    wordIndex,
    started,
    rowOffset,
    finished,
    timeLeft,
    wordInputs,
    showControls,
    isFocused,
    resetting,
    isActivelyTyping,
    screenFade,
    wpm,
    accuracy,
    // Computed
    controlsVisible,
    showResults,
    frozenStats: frozenStatsRef.current,
    // Refs
    inputRef,
    wordsContainerRef,
    activeWordRef,
    // Handlers
    handleKeyDown,
    handleInputChange,
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
    onRestart: () => resetTest(),
  };
}
