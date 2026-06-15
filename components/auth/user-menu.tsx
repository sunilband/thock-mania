"use client";

import {
  ClockCounterClockwiseIcon,
  GoogleLogoIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAppChrome } from "@/components/layout/app-chrome";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user, loading, signInWithGoogle, signOut, displayName, avatarUrl } =
    useAuth();
  const { setHistoryOpen } = useAppChrome();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuOpen]);

  if (loading) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-foreground/[0.06]" />
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-1.5 rounded-full bg-foreground/[0.05] p-1 pr-2.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.08] hover:text-foreground"
        onClick={() => setMenuOpen((prev) => !prev)}
        type="button"
      >
        {avatarUrl ? (
          <img
            alt={displayName}
            className="h-[26px] w-[26px] rounded-full object-cover"
            src={avatarUrl}
          />
        ) : (
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary/20 font-medium text-primary text-xs">
            {displayName[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden max-w-[100px] truncate sm:inline">
          {displayName}
        </span>
      </button>

      {menuOpen && (
        <motion.div
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute top-full right-0 z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm"
          initial={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <div className="border-border border-b px-3 py-2">
            <p className="truncate font-medium text-foreground text-xs">
              {displayName}
            </p>
            <p className="truncate text-[10px] text-muted-foreground/60">
              {user ? user.email : "Anonymous · scores still count!"}
            </p>
          </div>

          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors",
              "hover:bg-foreground/[0.05] hover:text-foreground"
            )}
            onClick={() => {
              setHistoryOpen(true);
              setMenuOpen(false);
            }}
            type="button"
          >
            <ClockCounterClockwiseIcon size={14} weight="duotone" />
            History
          </button>

          {user ? (
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors",
                "hover:bg-foreground/[0.05] hover:text-destructive"
              )}
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
              type="button"
            >
              <SignOutIcon size={14} weight="duotone" />
              Sign out
            </button>
          ) : (
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors",
                "hover:bg-foreground/[0.05] hover:text-foreground"
              )}
              onClick={() => {
                signInWithGoogle();
                setMenuOpen(false);
              }}
              type="button"
            >
              <GoogleLogoIcon size={14} weight="duotone" />
              Sign in with Google
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
