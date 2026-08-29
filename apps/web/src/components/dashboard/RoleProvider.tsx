"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Role } from "@/lib/dashboard-nav";

interface RoleContextValue {
  role: Role | null;
  name: string | null;
  username: string | null;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const COOKIE = "mhs_user";

function readCookieUsername(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

interface RoleProviderInitial {
  username: string;
  name: string;
  role: Role;
}

export function RoleProvider({
  initial,
  children,
}: {
  initial: RoleProviderInitial | null;
  children: React.ReactNode;
}) {
  const [role, setRoleState] = useState<Role | null>(initial?.role ?? null);
  const [name, setName] = useState<string | null>(initial?.name ?? null);
  const [username, setUsername] = useState<string | null>(
    initial?.username ?? null,
  );

  // Local helper used by mock flows. The real flow is: server sets the cookie
  // (via /api/auth/login), then router.refresh() re-renders this provider
  // with a fresh `initial` prop. These setters remain for one-off UI flows
  // (e.g. role-switcher in development).
  const setRole = useCallback((next: Role) => {
    document.cookie = `${COOKIE}=${encodeURIComponent("")}; path=/; max-age=0; samesite=lax`;
    setRoleState(next);
  }, []);

  const clearRole = useCallback(() => {
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    setRoleState(null);
    setName(null);
    setUsername(null);
  }, []);

  // Expose a tiny sync helper in case a child component wants to pick up
  // changes made to the cookie outside the React tree (e.g. the logout API).
  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      name,
      username,
      setRole,
      clearRole,
    }),
    [role, name, username, setRole, clearRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

/** Re-read the session cookie on demand (best-effort, client-only). */
export function readClientSession(): { username: string | null } {
  return { username: readCookieUsername() };
}
