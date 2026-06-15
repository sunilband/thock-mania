"use client";

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
import { useIdentityData } from "@/components/auth/identity-provider";
import type { SerializedUser } from "@/lib/get-identity";
import { migrateAnonymousData } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  avatarUrl: string;
  displayName: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  user: SerializedUser | null;
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
  const { anonDisplayName, anonAvatarUrl, initialUser } = useIdentityData();
  const [user, setUser] = useState<SerializedUser | null>(initialUser);
  const supabase = useMemo(() => createClient(), []);
  const migrationDone = useRef(false);

  // Listen for auth state changes (login/logout/token refresh) — client only
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? "",
          displayName:
            u.user_metadata?.full_name ?? u.user_metadata?.name ?? "User",
          avatarUrl:
            u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? "",
        });

        // Migrate anonymous data on first login
        if (!migrationDone.current) {
          migrationDone.current = true;
          migrateAnonymousData().catch(() => {
            /* non-critical */
          });
        }
      } else {
        setUser(null);
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

  const displayName = user ? user.displayName : anonDisplayName;
  const avatarUrl = user ? user.avatarUrl : anonAvatarUrl;

  const value = useMemo(
    () => ({ user, signInWithGoogle, signOut, displayName, avatarUrl }),
    [user, signInWithGoogle, signOut, displayName, avatarUrl]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
