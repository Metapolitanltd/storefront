"use client";

import type { Customer } from "@spree/sdk";
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
import { getCustomer } from "@/lib/data/customer";
import { veroLogout } from "@/lib/data/vero-auth";
import { VERO_LOGIN_PATH } from "@/lib/vero/config";

/**
 * Client-facing user shape. Identity (login state) comes from the Vero session,
 * but the user's profile details are read from the Spree customer record — the
 * Vero JWT is injected into the Spree SDK, so `getCustomer()` is authoritative
 * for name/email here.
 */
export interface User {
  id: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
}

/** @deprecated Use `User`. Kept as an alias during the Vero auth migration. */
export type VeroUser = User;

interface VeroAuthContextType {
  user: User | null;
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

function toUser(customer: Customer): User {
  return {
    id: customer.id,
    email: customer.email,
    first_name: customer.first_name,
    last_name: customer.last_name,
  };
}

export function VeroAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Profile/identity is read from the Spree customer record (Vero JWT injected
  // into the SDK), not from the Vero session claims.
  const refreshUser = useCallback(async () => {
    try {
      const customer = await getCustomer();
      setUser(customer ? toUser(customer) : null);
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
