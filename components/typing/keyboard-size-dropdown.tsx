"use client";

import { Check } from "@phosphor-icons/react";
import { IconChevronDown, IconKeyboard } from "@tabler/icons-react";
import { useState } from "react";
import {
  KEYBOARD_SIZE_OPTIONS,
  useSettings,
} from "@/components/settings/settings-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Compact on-page dropdown for picking the keyboard form factor. */
export function KeyboardSizeDropdown() {
  const { keyboardSize, setKeyboardSize } = useSettings();
  const [open, setOpen] = useState(false);
  const selected = KEYBOARD_SIZE_OPTIONS.find((o) => o.id === keyboardSize);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.08] hover:text-foreground"
        )}
      >
        <IconKeyboard className="size-4 opacity-70" />
        <span className="hidden sm:inline">{selected?.label ?? "Layout"}</span>
        <IconChevronDown
          className={cn(
            "size-3 opacity-40 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 gap-0.5 p-1.5"
        side="bottom"
        sideOffset={8}
      >
        {KEYBOARD_SIZE_OPTIONS.map((opt) => {
          const isActive = keyboardSize === opt.id;
          return (
            <button
              className={cn(
                "group/size flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150",
                isActive ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
              )}
              key={opt.id}
              onClick={() => {
                setKeyboardSize(opt.id);
                setOpen(false);
              }}
              type="button"
            >
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs transition-colors duration-150",
                      isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover/size:text-foreground"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {opt.keys}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground/60 leading-tight">
                  {opt.description}
                </span>
              </span>
              {isActive && (
                <Check
                  className="mt-0.5 shrink-0 text-primary"
                  size={14}
                  weight="duotone"
                />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
