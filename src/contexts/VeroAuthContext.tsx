"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getVeroSession, veroLogout } from "@/lib/data/vero-auth";
import { VERO_LOGIN_PATH } from "@/lib/vero/config";
import type { VeroSession } from "@/lib/vero/types";

/**
 * Client-facing user shape for the Vero (BFF hosted-login) flow. `id` is the
 * Vero `uid`; `first_name` carries the display name when Vero provides one.
 *
 * This is a separate provider from the legacy Spree `AuthContext` — the Spree
 * auth is decoupled for now, so account/identity reads go through Vero while
 * existing Spree consumers keep using the old context (as guests).
 */
export interface VeroUser {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface VeroAuthContextType {
  user: VeroUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Redirect the browser to Vero's hosted login (passkey / password). */
  signIn: (returnTo?: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const VeroAuthContext = createContext<VeroAuthContextType | undefined>(
  undefined,
);

function toUser(session: VeroSession): VeroUser {
  return {
    id: session.uid,
    email: session.email,
    first_name: session.username || null,
    last_name: null,
  };
}

export function VeroAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<VeroUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const session = await getVeroSession();
      setUser(session ? toUser(session) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await refreshUser();
      setLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  // Sign-in is a full-page redirect to the BFF login route → Vero hosted login.
  // No credentials or tokens are ever handled client-side.
  const signIn = useCallback((returnTo?: string) => {
    const target =
      returnTo ?? `${window.location.pathname}${window.location.search}`;
    window.location.href = `${VERO_LOGIN_PATH}?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(async () => {
    await veroLogout();
    setUser(null);
    router.refresh();
  }, [router]);

  const value = useMemo<VeroAuthContextType>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      signIn,
      logout,
      refreshUser,
    }),
    [user, loading, signIn, logout, refreshUser],
  );

  return (
    <VeroAuthContext.Provider value={value}>
      {children}
    </VeroAuthContext.Provider>
  );
}

export function useVeroAuth() {
  const context = useContext(VeroAuthContext);
  if (context === undefined) {
    throw new Error("useVeroAuth must be used within a VeroAuthProvider");
  }
  return context;
}
