"use client";

import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { QWERTY_LAYOUT } from "@/lib/keyboard-layouts";
import { cn } from "@/lib/utils";

import { KeyboardProvider, useKeyboardContext } from "./context";
import { type BoardCell, getBoardRows, SPECIAL_CONTENT } from "./layouts";
import { KEYBOARD_THEMES, resolveKeyVariant, toRgba } from "./themes";
import type { KEYCODE, KeyboardProps } from "./types";

// -----------------------------------------------------------------------------
// Public component
// -----------------------------------------------------------------------------

export function Keyboard({
  className,
  theme = "classic",
  enableSound = true,
  enableHaptics = true,
  soundUrl = "/sounds/sound.ogg",
  onKeyEvent,
  forceActive = false,
  physicalKeysEnabled = true,
  size = "75",
  volume = 0.5,
}: KeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layout = QWERTY_LAYOUT;

  return (
    <KeyboardProvider
      containerRef={containerRef}
      enableHaptics={enableHaptics}
      enableSound={enableSound}
      forceActive={forceActive}
      layout={layout}
      onKeyEvent={onKeyEvent}
      physicalKeysEnabled={physicalKeysEnabled}
      size={size}
      soundUrl={soundUrl}
      theme={theme}
      volume={volume}
    >
      <div className={cn("inline-block", className)} ref={containerRef}>
        <KeyboardKeys />
      </div>
    </KeyboardProvider>
  );
}

export default Keyboard;

// -----------------------------------------------------------------------------
// UI rendering
// -----------------------------------------------------------------------------

function KeyboardKeys() {
  const { layout, size } = useKeyboardContext();
  const rows = getBoardRows(size);

  /** Resolve dual labels for a key from the active layout, falling back to QWERTY. */
  function label(keyCode: string): [string, string?] | undefined {
    return layout[keyCode] ?? QWERTY_LAYOUT[keyCode];
  }

  function renderCell(cell: BoardCell, index: number) {
    if (cell.type === "gap") {
      return <div key={`gap-${index}`} style={{ width: cell.width }} />;
    }

    // Letter/number keys render their (possibly shifted) dual labels.
    const labels = label(cell.code);
    const hasSpecial = cell.code in SPECIAL_CONTENT;
    if (!hasSpecial && labels) {
      return (
        <DualKey
          key={cell.code}
          keyCode={cell.code}
          labels={labels}
          width={cell.width}
        />
      );
    }

    return (
      <Key key={cell.code} keyCode={cell.code} width={cell.width}>
        {SPECIAL_CONTENT[cell.code]}
      </Key>
    );
  }

  return (
    <div>
      <div className="h-fit w-fit rounded-[16px] border-2 border-black bg-black/70 p-3 dark:border-white/20 dark:bg-white/20">
        <div className="rounded-[5px] rounded-t-[8px] border border-black bg-black/80 pt-1 dark:border-zinc-500 dark:bg-zinc-700">
          <div className="-translate-y-1 -space-y-1 overflow-hidden rounded-[5px]">
            {rows.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are static per layout
              <Row key={rowIndex}>
                {row.map((cell, cellIndex) => renderCell(cell, cellIndex))}
              </Row>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex">{children}</div>;
}

/** Renders a key with one or two labels (shift label on top, normal on bottom). */
function DualKey({
  keyCode,
  labels,
  width,
}: {
  keyCode: KEYCODE;
  labels?: [string, string?];
  width?: number;
}) {
  if (!labels) {
    return <Key keyCode={keyCode} width={width} />;
  }
  const [normal, shift] = labels;
  if (shift) {
    return (
      <Key keyCode={keyCode} width={width}>
        <span>{shift}</span>
        <span>{normal}</span>
      </Key>
    );
  }
  return (
    <Key keyCode={keyCode} width={width}>
      {normal}
    </Key>
  );
}

interface KeyProps {
  children?: ReactNode;
  className?: string;
  keyCode?: KEYCODE;
  width?: number;
}

function Key({ width = 50, children, className, keyCode }: KeyProps) {
  const { themeName, pressedKeys, pressKey, releaseKey, triggerPointerHaptic } =
    useKeyboardContext();
  const isPressed = keyCode ? pressedKeys.has(keyCode) : false;
  const pointerSessionActiveRef = useRef(false);
  const [isPointerDownVisual, setIsPointerDownVisual] = useState(false);
  const visuallyPressed = isPressed || isPointerDownVisual;
  const keyVariantSlot = resolveKeyVariant(themeName, keyCode);
  const keyVariant = KEYBOARD_THEMES[themeName].variants[keyVariantSlot];

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!keyCode || event.button !== 0) {
      return;
    }

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on browsers/platforms that do not support this path.
    }

    if (pressKey(keyCode, "pointer")) {
      pointerSessionActiveRef.current = true;
      setIsPointerDownVisual(true);
    }
  };

  const handlePointerRelease = () => {
    setIsPointerDownVisual(false);
    if (!(keyCode && pointerSessionActiveRef.current)) {
      return;
    }

    pointerSessionActiveRef.current = false;
    releaseKey(keyCode, "pointer");
  };

  return (
    <button
      aria-label={keyCode}
      className="flex cursor-pointer touch-none appearance-none items-end border-0 bg-transparent p-0 text-left focus:outline-none"
      onClick={triggerPointerHaptic}
      onPointerCancel={handlePointerRelease}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      style={{ height: 50, width }}
      type="button"
    >
      <div
        className={cn(
          "relative flex h-[50px] items-start justify-center overflow-hidden rounded-[4px] rounded-t-[12px] border border-black/40 transition-all duration-100",
          visuallyPressed && "h-[45px]"
        )}
        style={{
          width: `${width}px`,
          backgroundColor: toRgba(keyVariant.bg, 0.8),
        }}
      >
        <div
          className={cn(
            "relative z-10 h-[37px] rounded-[6px] border border-black/40 border-t-0 transition-all duration-100",
            "flex select-none flex-col items-center justify-between gap-0.5 p-1 font-medium text-[9px]",
            className
          )}
          style={{
            width: `${width - 13}px`,
            backgroundColor: keyVariant.bg,
            color: keyVariant.text,
          }}
        >
          {children}
        </div>

        <div
          className={cn(
            "absolute right-0 bottom-0 z-0 h-px w-8 translate-x-3.5 rotate-70 bg-black/30 transition-all duration-100",
            visuallyPressed && "rotate-60"
          )}
        />
        <div
          className={cn(
            "absolute bottom-0 left-0 z-0 h-px w-8 -translate-x-3.5 -rotate-70 bg-black/30 transition-all duration-100",
            visuallyPressed && "-rotate-60"
          )}
        />
      </div>
    </button>
  );
}
