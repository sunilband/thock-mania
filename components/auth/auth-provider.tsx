"use client";

import type { User } from "@supabase/supabase-js";
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
import {
  generateAnonAvatarUrl,
  generateAnonName,
  getAnonymousUid,
} from "@/lib/anonymous-identity";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  /** The anonymous profile ID (for DB writes when not logged in) */
  anonProfileId: string | null;
  /** Display name — Google name or generated anonymous name */
  displayName: string;
  /** Avatar URL — Google avatar or generated anonymous avatar */
  avatarUrl: string;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anonProfileId, setAnonProfileId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const migrationDone = useRef(false);

  // Anonymous identity (stable across sessions)
  const anonymousUid = useMemo(
    () => (typeof window !== "undefined" ? getAnonymousUid() : ""),
    []
  );
  const anonName = useMemo(() => generateAnonName(anonymousUid), [anonymousUid]);
  const anonAvatar = useMemo(
    () => generateAnonAvatarUrl(anonymousUid),
    [anonymousUid]
  );

  // Ensure anonymous profile exists in DB
  useEffect(() => {
    if (!anonymousUid) return;

    fetch("/api/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousUid,
        displayName: anonName,
        avatarUrl: anonAvatar,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.profileId) {
          setAnonProfileId(data.profileId);
        }
      })
      .catch(() => {
        /* network error — ignore silently */
      });
  }, [anonymousUid, anonName, anonAvatar]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);

      // Migrate anonymous data when user logs in for the first time
      if (newUser && !migrationDone.current && anonymousUid) {
        migrationDone.current = true;
        fetch("/api/migrate-anonymous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonymousUid }),
        }).catch(() => {
          /* migration failed — non-critical */
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, anonymousUid]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  // Resolved display name and avatar
  const displayName = user
    ? (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "User")
    : anonName;
  const avatarUrl = user
    ? (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? anonAvatar)
    : anonAvatar;

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signOut,
      anonProfileId,
      displayName,
      avatarUrl,
    }),
    [user, loading, signInWithGoogle, signOut, anonProfileId, displayName, avatarUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
