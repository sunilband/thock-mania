export interface WpmSnapshot {
  errors: number;
  raw: number;
  second: number;
  wpm: number;
}

export interface ResultStats {
  accuracy: number;
  consistency: number;
  correctChars: number;
  correctedErrors: number;
  elapsedSeconds: number;
  extraChars: number;
  incorrectChars: number;
  missedChars: number;
  mode: string;
  modeDetail: string;
  raw: number;
  wpm: number;
  wpmHistory: WpmSnapshot[];
}

/**
 * Raw run data the client sends to the server for authoritative scoring.
 * Contains NO computed score — the server recomputes everything from the typed
 * input and keystroke timing against its own signed word list.
 */
export interface TestSubmission {
  /** opaque signed challenge from startTest (binds the server's word list) */
  token: string;
  /** committed per-word inputs, index-aligned with the target words */
  wordInputs: string[];
  /** in-progress final word */
  typed: string;
  /** active word index */
  wordIndex: number;
  /** ms offset (from test start) of each character + space keystroke, in order */
  keystrokeTimes: number[];
}
