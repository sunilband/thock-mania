"use client";

import { ArrowClockwiseIcon, XIcon } from "@phosphor-icons/react";
import { useSerwist } from "@serwist/turbopack/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Shows a small "new version available — reload" toast when the service worker
 * updates. Because the SW uses `skipWaiting` + `clientsClaim`, a new build
 * activates and starts controlling fetches immediately while the currently open
 * page still runs the old JS bundle. Reloading swaps the page onto the fresh
 * assets — this prompt nudges users to do that promptly (and avoids stale
 * chunk-load errors after a deploy).
 */
export function UpdateToast() {
    const { serwist } = useSerwist();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!serwist) {
            return;
        }

        const onControlling = (event: { isUpdate?: boolean }) => {
            // Only prompt for genuine updates, not the first-ever SW install.
            if (event.isUpdate) {
                setShow(true);
            }
        };
        const onWaiting = () => setShow(true);

        serwist.addEventListener("controlling", onControlling);
        serwist.addEventListener("waiting", onWaiting);
        return () => {
            serwist.removeEventListener("controlling", onControlling);
            serwist.removeEventListener("waiting", onWaiting);
        };
    }, [serwist]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="-translate-x-1/2 fixed bottom-4 left-1/2 z-[60] flex items-center gap-3 rounded-full border border-border bg-background/95 py-2 pr-2 pl-4 shadow-lg backdrop-blur"
                    exit={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                >
                    <span className="text-foreground text-sm">
                        A new version is available
                    </span>
                    <button
                        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90"
                        onClick={() => window.location.reload()}
                        type="button"
                    >
                        <ArrowClockwiseIcon size={14} weight="bold" />
                        Reload
                    </button>
                    <button
                        aria-label="Dismiss"
                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                        onClick={() => setShow(false)}
                        type="button"
                    >
                        <XIcon size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
