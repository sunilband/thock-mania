import {
    IconArrowNarrowLeft,
    IconBrightnessDown,
    IconBrightnessUp,
    IconBulb,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronUp,
    IconCommand,
    IconCornerDownLeft,
    IconFrame,
    IconLayoutDashboard,
    IconMicrophone,
    IconMoon,
    IconPlayerSkipForward,
    IconPlayerTrackNext,
    IconPlayerTrackPrev,
    IconSearch,
    IconVolume,
    IconVolume2,
    IconVolume3,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { KEYCODE, type KeyboardSize } from "./types";

// -----------------------------------------------------------------------------
// Board model
//
// A board is a list of rows; each row is a list of cells. A cell is either a
// key (with a pixel width) or a transparent gap. Every row in a given board
// sums to the same total width so the form factor renders as a clean grid.
// -----------------------------------------------------------------------------

export interface KeyCell {
    type: "key";
    code: KEYCODE;
    /** Pixel width. The base 1u key is 50px. */
    width: number;
}

export interface GapCell {
    type: "gap";
    width: number;
}

export type BoardCell = KeyCell | GapCell;
export type BoardRow = BoardCell[];

const U = 50; // one key unit, in pixels

function k(code: KEYCODE, width: number = U): KeyCell {
    return { type: "key", code, width };
}

function gap(width: number): GapCell {
    return { type: "gap", width };
}

/** Spread a list of keycodes as 1u keys. */
function keys(...codes: KEYCODE[]): KeyCell[] {
    return codes.map((c) => k(c));
}

// -----------------------------------------------------------------------------
// Letter / number groups (rendered as dual-label keys)
// -----------------------------------------------------------------------------

const NUMS = [
    KEYCODE.Backquote,
    KEYCODE.Digit1,
    KEYCODE.Digit2,
    KEYCODE.Digit3,
    KEYCODE.Digit4,
    KEYCODE.Digit5,
    KEYCODE.Digit6,
    KEYCODE.Digit7,
    KEYCODE.Digit8,
    KEYCODE.Digit9,
    KEYCODE.Digit0,
    KEYCODE.Minus,
    KEYCODE.Equal,
];

const TOPS = [
    KEYCODE.KeyQ,
    KEYCODE.KeyW,
    KEYCODE.KeyE,
    KEYCODE.KeyR,
    KEYCODE.KeyT,
    KEYCODE.KeyY,
    KEYCODE.KeyU,
    KEYCODE.KeyI,
    KEYCODE.KeyO,
    KEYCODE.KeyP,
    KEYCODE.BracketLeft,
    KEYCODE.BracketRight,
];

const MIDS = [
    KEYCODE.KeyA,
    KEYCODE.KeyS,
    KEYCODE.KeyD,
    KEYCODE.KeyF,
    KEYCODE.KeyG,
    KEYCODE.KeyH,
    KEYCODE.KeyJ,
    KEYCODE.KeyK,
    KEYCODE.KeyL,
    KEYCODE.Semicolon,
    KEYCODE.Quote,
];

const BOTS = [
    KEYCODE.KeyZ,
    KEYCODE.KeyX,
    KEYCODE.KeyC,
    KEYCODE.KeyV,
    KEYCODE.KeyB,
    KEYCODE.KeyN,
    KEYCODE.KeyM,
    KEYCODE.Comma,
    KEYCODE.Period,
    KEYCODE.Slash,
];

const TOPS_ALPHA = TOPS.slice(0, 10); // Q..P
const MIDS_ALPHA = MIDS.slice(0, 9); // A..L

// -----------------------------------------------------------------------------
// Row segments shared across form factors
// -----------------------------------------------------------------------------

/** Standard function row (Esc + F1–F12 + extras), contiguous, 800px. */
function functionRow800(): BoardRow {
    return [
        k(KEYCODE.Escape),
        ...keys(
            KEYCODE.F1,
            KEYCODE.F2,
            KEYCODE.F3,
            KEYCODE.F4,
            KEYCODE.F5,
            KEYCODE.F6,
            KEYCODE.F7,
            KEYCODE.F8,
            KEYCODE.F9,
            KEYCODE.F10,
            KEYCODE.F11,
            KEYCODE.F12
        ),
        k(KEYCODE.F13),
        k(KEYCODE.Delete),
        k(KEYCODE.F14),
    ];
}

/** Function row for boards with separated clusters (750px, grouped with gaps). */
function functionRow750(): BoardRow {
    return [
        k(KEYCODE.Escape),
        gap(U),
        ...keys(KEYCODE.F1, KEYCODE.F2, KEYCODE.F3, KEYCODE.F4),
        gap(U / 2),
        ...keys(KEYCODE.F5, KEYCODE.F6, KEYCODE.F7, KEYCODE.F8),
        gap(U / 2),
        ...keys(KEYCODE.F9, KEYCODE.F10, KEYCODE.F11, KEYCODE.F12),
    ];
}

// -- 60%-style main block (750px wide, no nav column, no arrows) --------------

function mainBlock750(): BoardRow[] {
    return [
        [...keys(...NUMS), k(KEYCODE.Backspace, 2 * U)],
        [k(KEYCODE.Tab, 1.5 * U), ...keys(...TOPS), k(KEYCODE.Backslash, 1.5 * U)],
        [k(KEYCODE.CapsLock, 1.75 * U), ...keys(...MIDS), k(KEYCODE.Enter, 2.25 * U)],
        [k(KEYCODE.ShiftLeft, 2.25 * U), ...keys(...BOTS), k(KEYCODE.ShiftRight, 2.75 * U)],
        [
            k(KEYCODE.ControlLeft, 1.25 * U),
            k(KEYCODE.MetaLeft, 1.25 * U),
            k(KEYCODE.AltLeft, 1.25 * U),
            k(KEYCODE.Space, 6.25 * U),
            k(KEYCODE.AltRight, 1.25 * U),
            k(KEYCODE.MetaRight, 1.25 * U),
            k(KEYCODE.Fn, 1.25 * U),
            k(KEYCODE.ControlRight, 1.25 * U),
        ],
    ];
}

// -- 75%/65%-style main block (800px, integrated nav column + arrows) ---------

function mainBlock800(): BoardRow[] {
    return [
        [...keys(...NUMS), k(KEYCODE.Backspace, 2 * U), k(KEYCODE.PageUp)],
        [
            k(KEYCODE.Tab, 1.5 * U),
            ...keys(...TOPS),
            k(KEYCODE.Backslash, 1.5 * U),
            k(KEYCODE.PageDown),
        ],
        [
            k(KEYCODE.CapsLock, 2 * U),
            ...keys(...MIDS),
            k(KEYCODE.Enter, 2 * U),
            k(KEYCODE.Home),
        ],
        [
            k(KEYCODE.ShiftLeft, 123),
            ...keys(...BOTS),
            k(KEYCODE.ShiftRight, 77),
            k(KEYCODE.ArrowUp),
            k(KEYCODE.End),
        ],
        [
            k(KEYCODE.ControlLeft, 62),
            k(KEYCODE.AltLeft, 62),
            k(KEYCODE.MetaLeft, 62),
            k(KEYCODE.Space, 314),
            k(KEYCODE.MetaRight),
            k(KEYCODE.Fn),
            k(KEYCODE.ControlRight),
            k(KEYCODE.ArrowLeft),
            k(KEYCODE.ArrowDown),
            k(KEYCODE.ArrowRight),
        ],
    ];
}

// -- Separated navigation cluster (150px, inverted-T arrows) ------------------
// Six rows aligned to the main rows (function row first).

function navCluster(includeFunctionRow: boolean): BoardRow[] {
    const rows: BoardRow[] = [
        [...keys(KEYCODE.Insert, KEYCODE.Home, KEYCODE.PageUp)],
        [...keys(KEYCODE.Delete, KEYCODE.End, KEYCODE.PageDown)],
        [gap(3 * U)],
        [gap(U), k(KEYCODE.ArrowUp), gap(U)],
        [...keys(KEYCODE.ArrowLeft, KEYCODE.ArrowDown, KEYCODE.ArrowRight)],
    ];
    return includeFunctionRow ? [[gap(3 * U)], ...rows] : rows;
}

// -- Numpad cluster (200px) ---------------------------------------------------
// Rows align to number-row downward; the top (function) row is empty.

function numpadCluster(includeFunctionRow: boolean): BoardRow[] {
    const rows: BoardRow[] = [
        [
            ...keys(
                KEYCODE.NumLock,
                KEYCODE.NumpadDivide,
                KEYCODE.NumpadMultiply,
                KEYCODE.NumpadSubtract
            ),
        ],
        [...keys(KEYCODE.Numpad7, KEYCODE.Numpad8, KEYCODE.Numpad9, KEYCODE.NumpadAdd)],
        [
            ...keys(
                KEYCODE.Numpad4,
                KEYCODE.Numpad5,
                KEYCODE.Numpad6,
                KEYCODE.NumpadEqual
            ),
        ],
        [
            ...keys(
                KEYCODE.Numpad1,
                KEYCODE.Numpad2,
                KEYCODE.Numpad3,
                KEYCODE.NumpadEnter
            ),
        ],
        [k(KEYCODE.Numpad0, 2 * U), k(KEYCODE.NumpadDecimal), gap(U)],
    ];
    return includeFunctionRow ? [[gap(4 * U)], ...rows] : rows;
}

// -----------------------------------------------------------------------------
// Compose rows side-by-side into full board rows.
// -----------------------------------------------------------------------------

function joinColumns(columns: BoardRow[][], gapWidth: number): BoardRow[] {
    const rowCount = Math.max(...columns.map((c) => c.length));
    const out: BoardRow[] = [];
    for (let i = 0; i < rowCount; i++) {
        const row: BoardRow = [];
        columns.forEach((col, colIndex) => {
            if (colIndex > 0) {
                row.push(gap(gapWidth));
            }
            row.push(...(col[i] ?? []));
        });
        out.push(row);
    }
    return out;
}

// -----------------------------------------------------------------------------
// Board definitions per size
// -----------------------------------------------------------------------------

const CLUSTER_GAP = 12;
const NUMPAD_GAP = 10;

function build40(): BoardRow[] {
    // Every row sums to 12U so the right edge stays flush.
    return [
        [...keys(...TOPS_ALPHA), k(KEYCODE.Backspace, 2 * U)],
        [
            k(KEYCODE.Tab, 1.5 * U),
            ...keys(...MIDS_ALPHA),
            k(KEYCODE.Enter, 1.5 * U),
        ],
        [k(KEYCODE.ShiftLeft), ...keys(...BOTS), k(KEYCODE.ShiftRight)],
        [
            k(KEYCODE.ControlLeft, 1.5 * U),
            k(KEYCODE.MetaLeft, 1.5 * U),
            k(KEYCODE.AltLeft, 1.5 * U),
            k(KEYCODE.Space, 3 * U),
            k(KEYCODE.AltRight, 1.5 * U),
            k(KEYCODE.Fn, 1.5 * U),
            k(KEYCODE.ControlRight, 1.5 * U),
        ],
    ];
}

export function getBoardRows(size: KeyboardSize): BoardRow[] {
    switch (size) {
        case "40":
            return build40();
        case "60":
            return mainBlock750();
        case "65":
            return mainBlock800();
        case "75":
            return [functionRow800(), ...mainBlock800()];
        case "1800":
            return joinColumns(
                [[functionRow800(), ...mainBlock800()], numpadCluster(true)],
                NUMPAD_GAP
            );
        case "tkl":
            return joinColumns(
                [[functionRow750(), ...mainBlock750()], navCluster(true)],
                CLUSTER_GAP
            );
        case "full":
            return joinColumns(
                [
                    [functionRow750(), ...mainBlock750()],
                    navCluster(true),
                    numpadCluster(true),
                ],
                CLUSTER_GAP
            );
        default:
            return [functionRow800(), ...mainBlock800()];
    }
}

// -----------------------------------------------------------------------------
// Content for non-letter ("special") keys. Letter/number keys fall through to
// the active layout's dual labels.
// -----------------------------------------------------------------------------

const ICON = "size-[10px]";

export const SPECIAL_CONTENT: Partial<Record<KEYCODE, ReactNode>> = {
    [KEYCODE.Escape]: "esc",
    [KEYCODE.F1]: (
        <>
            <IconBrightnessDown className={ICON} />
            <span>{"F1"}</span>
        </>
    ),
    [KEYCODE.F2]: (
        <>
            <IconBrightnessUp className={ICON} />
            <span>{"F2"}</span>
        </>
    ),
    [KEYCODE.F3]: (
        <>
            <IconLayoutDashboard className={ICON} />
            <span>{"F3"}</span>
        </>
    ),
    [KEYCODE.F4]: (
        <>
            <IconSearch className={ICON} />
            <span>{"F4"}</span>
        </>
    ),
    [KEYCODE.F5]: (
        <>
            <IconMicrophone className={ICON} />
            <span>{"F5"}</span>
        </>
    ),
    [KEYCODE.F6]: (
        <>
            <IconMoon className={ICON} />
            <span>{"F6"}</span>
        </>
    ),
    [KEYCODE.F7]: (
        <>
            <IconPlayerTrackPrev className={ICON} />
            <span>{"F7"}</span>
        </>
    ),
    [KEYCODE.F8]: (
        <>
            <IconPlayerSkipForward className={ICON} />
            <span>{"F8"}</span>
        </>
    ),
    [KEYCODE.F9]: (
        <>
            <IconPlayerTrackNext className={ICON} />
            <span>{"F9"}</span>
        </>
    ),
    [KEYCODE.F10]: (
        <>
            <IconVolume3 className={ICON} />
            <span>{"F10"}</span>
        </>
    ),
    [KEYCODE.F11]: (
        <>
            <IconVolume2 className={ICON} />
            <span>{"F11"}</span>
        </>
    ),
    [KEYCODE.F12]: (
        <>
            <IconVolume className={ICON} />
            <span>{"F12"}</span>
        </>
    ),
    [KEYCODE.F13]: <IconFrame className={ICON} />,
    [KEYCODE.F14]: <IconBulb className="size-[12px]" />,
    [KEYCODE.Delete]: "del",
    [KEYCODE.Insert]: "ins",
    [KEYCODE.Backspace]: <IconArrowNarrowLeft className="size-[12px]" />,
    [KEYCODE.Tab]: "tab",
    [KEYCODE.CapsLock]: "caps lock",
    [KEYCODE.Enter]: "return",
    [KEYCODE.ShiftLeft]: "shift",
    [KEYCODE.ShiftRight]: "shift",
    [KEYCODE.ControlLeft]: "ctrl",
    [KEYCODE.ControlRight]: "ctrl",
    [KEYCODE.AltLeft]: "option",
    [KEYCODE.AltRight]: "option",
    [KEYCODE.MetaLeft]: <IconCommand className="size-[12px]" />,
    [KEYCODE.MetaRight]: <IconCommand className="size-[12px]" />,
    [KEYCODE.Fn]: "fn",
    [KEYCODE.Space]: null,
    [KEYCODE.PageUp]: "pgup",
    [KEYCODE.PageDown]: "pgdn",
    [KEYCODE.Home]: "home",
    [KEYCODE.End]: "end",
    [KEYCODE.ArrowUp]: <IconChevronUp className="size-[12px]" />,
    [KEYCODE.ArrowDown]: <IconChevronDown className="size-[12px]" />,
    [KEYCODE.ArrowLeft]: <IconChevronLeft className="size-[12px]" />,
    [KEYCODE.ArrowRight]: <IconChevronRight className="size-[12px]" />,
    [KEYCODE.NumLock]: "num",
    [KEYCODE.NumpadDivide]: "/",
    [KEYCODE.NumpadMultiply]: "*",
    [KEYCODE.NumpadSubtract]: "-",
    [KEYCODE.NumpadAdd]: "+",
    [KEYCODE.NumpadEqual]: "=",
    [KEYCODE.NumpadDecimal]: ".",
    [KEYCODE.NumpadEnter]: <IconCornerDownLeft className="size-[12px]" />,
    [KEYCODE.Numpad0]: "0",
    [KEYCODE.Numpad1]: "1",
    [KEYCODE.Numpad2]: "2",
    [KEYCODE.Numpad3]: "3",
    [KEYCODE.Numpad4]: "4",
    [KEYCODE.Numpad5]: "5",
    [KEYCODE.Numpad6]: "6",
    [KEYCODE.Numpad7]: "7",
    [KEYCODE.Numpad8]: "8",
    [KEYCODE.Numpad9]: "9",
};
