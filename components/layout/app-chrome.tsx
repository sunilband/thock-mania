"use client";

import {
  CommandIcon,
  GearSixIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { ThockManiaLogo } from "@/components/layout/thock-mania-logo";
import { VisitorCount } from "@/components/layout/visitor-count";
import { useSettings } from "@/components/settings/settings-provider";
import { DynamicFavicon } from "@/components/theme/dynamic-favicon";
import { KeyboardSizeDropdown } from "@/components/typing/keyboard-size-dropdown";

const SettingsPanel = dynamic(
  () =>
    import("@/components/settings/settings-panel").then(
      (mod) => mod.SettingsPanel
    ),
  { ssr: false }
);

const HistoryPanel = dynamic(
  () =>
    import("@/components/typing/history/history-panel").then(
      (mod) => mod.HistoryPanel
    ),
  { ssr: false }
);

interface AppChromeContextValue {
  homeLogoHandlerRef: React.MutableRefObject<(() => void) | null>;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTypingActive: (active: boolean) => void;
  settingsOpen: boolean;
  typingActive: boolean;
}

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function useAppChrome() {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error("useAppChrome must be used within AppChrome");
  }
  return ctx;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [typingActive, setTypingActive] = useState(false);
  const homeLogoHandlerRef = useRef<(() => void) | null>(null);

  // ⌘K to toggle settings, ⌘H to toggle history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSettingsLoaded(true);
        setSettingsOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        setHistoryLoaded(true);
        setHistoryOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track when panels should mount (once opened, stay mounted)
  const handleSettingsOpen = useCallback((open: boolean) => {
    if (open) setSettingsLoaded(true);
    setSettingsOpen(open);
  }, []);

  const handleHistoryOpen = useCallback((open: boolean) => {
    if (open) setHistoryLoaded(true);
    setHistoryOpen(open);
  }, []);

  const value = useMemo(
    () => ({
      settingsOpen,
      setSettingsOpen: handleSettingsOpen,
      historyOpen,
      setHistoryOpen: handleHistoryOpen,
      typingActive,
      setTypingActive,
      homeLogoHandlerRef,
    }),
    [settingsOpen, historyOpen, typingActive, handleSettingsOpen, handleHistoryOpen]
  );

  return (
    <AppChromeContext.Provider value={value}>
      <DynamicFavicon />
      <div className="flex min-h-dvh w-full flex-col">
        <SiteHeader />
        {children}
      </div>
      {settingsLoaded && (
        <SettingsPanel onOpenChange={handleSettingsOpen} open={settingsOpen} />
      )}
      {historyLoaded && (
        <HistoryPanel onOpenChange={handleHistoryOpen} open={historyOpen} />
      )}
    </AppChromeContext.Provider>
  );
}

function SiteHeader() {
  const router = useRouter();
  const { setSettingsOpen, typingActive, homeLogoHandlerRef } =
    useAppChrome();
  const { showKeyboard } = useSettings();

  const dimHeader = typingActive;

  const [mouseHeaderVisible, setMouseHeaderVisible] = useState(false);
  const headerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerVisible = !typingActive || mouseHeaderVisible;

  useEffect(
    () => () => {
      if (headerTimerRef.current) {
        clearTimeout(headerTimerRef.current);
      }
    },
    []
  );

  const handleHeaderMouseMove = useCallback(() => {
    if (!typingActive) {
      return;
    }
    setMouseHeaderVisible(true);
    if (headerTimerRef.current) {
      clearTimeout(headerTimerRef.current);
    }
    headerTimerRef.current = setTimeout(
      () => setMouseHeaderVisible(false),
      2500
    );
  }, [typingActive]);

  function handleLogoClick() {
    if (homeLogoHandlerRef.current) {
      homeLogoHandlerRef.current();
      return;
    }
    router.push("/");
  }

  const headerOpacity = dimHeader ? (headerVisible ? 1 : 0.1) : 1;

  return (
    <motion.header
      animate={{ opacity: headerOpacity }}
      className="flex shrink-0 justify-center px-6 py-4 md:px-10 md:py-5"
      onMouseMove={handleHeaderMouseMove}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      <div className="relative flex w-full max-w-5xl items-center justify-between">
        {/* Left — Logo + Visitor Count */}
        <div className="flex items-center gap-4">
          <button
            className="flex cursor-pointer items-center gap-1.5 font-semibold text-primary text-xl tracking-tight"
            onClick={handleLogoClick}
            type="button"
          >
            <ThockManiaLogo size={20} />
            Thock Mania
          </button>
          <div className="hidden md:block">
            <VisitorCount />
          </div>
        </div>

        {/* Right — Settings, GitHub, User */}
        <div className="flex items-center gap-2">
          {/* Keyboard layout size — only when the on-screen keyboard is shown */}
          {showKeyboard && (
            <div className="hidden lg:block">
              <KeyboardSizeDropdown />
            </div>
          )}

          {/* Settings */}
          <motion.button
            aria-label="Settings"
            className="flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.08] hover:text-foreground"
            onClick={() => setSettingsOpen(true)}
            type="button"
            whileTap={{ scale: 0.97 }}
          >
            <GearSixIcon size={15} weight="duotone" />
            <span className="hidden sm:inline">Settings</span>
            <kbd className="hidden items-center gap-px rounded border border-foreground/10 bg-foreground/[0.04] px-1 py-0.5 text-[10px] text-muted-foreground/40 leading-none sm:inline-flex">
              <CommandIcon size={10} weight="duotone" />
              <span>K</span>
            </kbd>
          </motion.button>

          {/* Leaderboard */}
          <motion.button
            aria-label="Leaderboard"
            className="flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.08] hover:text-foreground"
            onClick={() => router.push("/leaderboard")}
            type="button"
            whileTap={{ scale: 0.97 }}
          >
            <TrophyIcon size={15} weight="duotone" />
            <span className="hidden sm:inline">Leaderboard</span>
          </motion.button>

          {/* User menu / Sign in */}
          <UserMenu />
        </div>
      </div>
    </motion.header>
  );
}
