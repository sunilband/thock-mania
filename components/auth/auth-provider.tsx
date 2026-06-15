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
import { migrateAnonymousData } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  avatarUrl: string;
  displayName: string;
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

interface AuthProviderProps {
  children: ReactNode;
  /** Anonymous display name resolved server-side from cookie */
  anonDisplayName: string;
  /** Anonymous avatar URL resolved server-side from cookie */
  anonAvatarUrl: string;
}

export function AuthProvider({
  children,
  anonDisplayName,
  anonAvatarUrl,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const migrationDone = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);

      // Migrate anonymous data when user logs in
      if (newUser && !migrationDone.current) {
        migrationDone.current = true;
        migrateAnonymousData().catch(() => {
          /* non-critical */
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

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

  const displayName = user
    ? (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "User")
    : anonDisplayName;

  const avatarUrl = user
    ? (user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "")
    : anonAvatarUrl;

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signOut, displayName, avatarUrl }),
    [user, loading, signInWithGoogle, signOut, displayName, avatarUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
