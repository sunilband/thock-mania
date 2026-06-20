"use client";

import { CheckIcon, InfoIcon } from "@phosphor-icons/react";
import { IconBook2, IconChevronDown } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
    TOPIC_OPTIONS,
    useSettings,
} from "@/components/settings/settings-provider";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { isRankedTopic, type TopicId } from "@/lib/topic-options";
import { cn } from "@/lib/utils";

/** Header dropdown for picking the text content (topic) of the typing test. */
export function TopicDropdown() {
    const { topic, setTopic } = useSettings();
    const [open, setOpen] = useState(false);
    const [notice, setNotice] = useState(false);
    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selected = TOPIC_OPTIONS.find((o) => o.id === topic);
    const unranked = !isRankedTopic(topic);

    useEffect(
        () => () => {
            if (noticeTimer.current) {
                clearTimeout(noticeTimer.current);
            }
        },
        []
    );

    const handleSelect = (id: TopicId) => {
        setTopic(id);
        setOpen(false);
        if (noticeTimer.current) {
            clearTimeout(noticeTimer.current);
        }
        // Pop up a heads-up only when switching to a non-leaderboard topic.
        if (isRankedTopic(id)) {
            setNotice(false);
        } else {
            setNotice(true);
            noticeTimer.current = setTimeout(() => setNotice(false), 4500);
        }
    };

    return (
        <>
            <Popover onOpenChange={setOpen} open={open}>
                <PopoverTrigger
                    className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors duration-150",
                        unranked
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground"
                    )}
                >
                    <IconBook2 className="size-4 opacity-70" />
                    <span className="hidden sm:inline">{selected?.label ?? "Topic"}</span>
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
                    {TOPIC_OPTIONS.map((opt) => {
                        const isActive = topic === opt.id;
                        return (
                            <button
                                className={cn(
                                    "group/topic flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150",
                                    isActive
                                        ? "bg-foreground/[0.06]"
                                        : "hover:bg-foreground/[0.03]"
                                )}
                                key={opt.id}
                                onClick={() => handleSelect(opt.id)}
                                type="button"
                            >
                                <span className="flex flex-col gap-0.5">
                                    <span
                                        className={cn(
                                            "flex items-center gap-1.5 text-xs transition-colors duration-150",
                                            isActive
                                                ? "font-medium text-foreground"
                                                : "text-muted-foreground group-hover/topic:text-foreground"
                                        )}
                                    >
                                        {opt.label}
                                        {opt.id === "random_words" && (
                                            <span className="rounded-full bg-primary/10 px-1.5 py-px font-semibold text-[9px] text-primary leading-tight">
                                                Ranked
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/60 leading-tight">
                                        {opt.description}
                                    </span>
                                </span>
                                {isActive && (
                                    <CheckIcon
                                        className="mt-0.5 shrink-0 text-primary"
                                        size={14}
                                        weight="duotone"
                                    />
                                )}
                            </button>
                        );
                    })}
                    <p className="mt-1 border-foreground/10 border-t px-3 pt-2 text-[10px] text-muted-foreground/60 leading-tight">
                        Only <span className="text-foreground/80">Random words</span> counts
                        toward the leaderboard.
                    </p>
                </PopoverContent>
            </Popover>

            {/* Transient heads-up when a non-leaderboard topic is picked. */}
            <AnimatePresence>
                {notice && (
                    <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed inset-x-0 bottom-6 z-[200] flex justify-center px-4"
                        exit={{ opacity: 0, y: 12 }}
                        initial={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                        <div className="flex max-w-md items-start gap-2.5 rounded-xl bg-popover px-4 py-3 text-popover-foreground text-sm shadow-lg ring-1 ring-foreground/10">
                            <InfoIcon
                                className="mt-0.5 shrink-0 text-primary"
                                size={16}
                                weight="duotone"
                            />
                            <span className="leading-snug">
                                <span className="font-medium">
                                    {selected?.label ?? "This topic"}
                                </span>{" "}
                                is practice only — these runs won't be added to the leaderboard.
                                Switch back to{" "}
                                <span className="text-foreground">Random words</span> to
                                compete.
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
