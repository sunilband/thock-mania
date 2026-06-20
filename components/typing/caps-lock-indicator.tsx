"use client";

import { ArrowFatUpIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Fixed bottom-left "Caps Lock" warning, visible only while caps lock is on.
 *
 * ponytail: the browser only reveals caps-lock state inside a keyboard event
 * (getModifierState), never on demand — so the indicator can't reflect a caps
 * lock that was already on before the first keypress. It syncs on the next key
 * event, which is the only signal available without a privileged API.
 */
export function CapsLockIndicator() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        const sync = (e: KeyboardEvent) => {
            if (typeof e.getModifierState === "function") {
                setOn(e.getModifierState("CapsLock"));
            }
        };
        window.addEventListener("keydown", sync);
        window.addEventListener("keyup", sync);
        return () => {
            window.removeEventListener("keydown", sync);
            window.removeEventListener("keyup", sync);
        };
    }, []);

    return (
        <AnimatePresence>
            {on && (
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    aria-live="polite"
                    className="pointer-events-none fixed bottom-5 left-5 z-[200] flex items-center gap-2 rounded-xl bg-popover px-3.5 py-2 text-popover-foreground text-sm shadow-lg ring-1 ring-foreground/10"
                    exit={{ opacity: 0, y: 8 }}
                    initial={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                >
                    <ArrowFatUpIcon className="text-primary" size={16} weight="duotone" />
                    <span className="font-medium">Caps Lock is on</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
