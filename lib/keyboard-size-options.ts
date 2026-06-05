import type { KeyboardSize } from "@/components/ui/keyboard";

export const KEYBOARD_SIZE_OPTIONS: {
  id: KeyboardSize;
  label: string;
  keys: string;
  description: string;
}[] = [
  {
    id: "full",
    label: "100% (Full-Size)",
    keys: "104–108 keys",
    description: "Alphanumeric, function row, navigation cluster, and numpad.",
  },
  {
    id: "1800",
    label: "96% / 1800-Compact",
    keys: "96–103 keys",
    description: "Keeps the numpad and arrows, compressed without the gaps.",
  },
  {
    id: "tkl",
    label: "80% (TKL)",
    keys: "87–88 keys",
    description: "Function row and arrows, with the numpad removed.",
  },
  {
    id: "75",
    label: "75%",
    keys: "79–84 keys",
    description: "Function and arrow keys with a tight navigation column.",
  },
  {
    id: "65",
    label: "65%",
    keys: "66–68 keys",
    description: "Drops the function row but keeps dedicated arrow keys.",
  },
  {
    id: "60",
    label: "60%",
    keys: "61–64 keys",
    description: "Alphanumeric and modifiers only; no function or arrow keys.",
  },
  {
    id: "40",
    label: "40%",
    keys: "40–47 keys",
    description: "Alphanumeric core only; numbers and symbols use layers.",
  },
];

export const DEFAULT_KEYBOARD_SIZE: KeyboardSize = "75";
