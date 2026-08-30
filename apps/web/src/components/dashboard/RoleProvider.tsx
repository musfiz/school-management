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
  id: number | null;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

interface RoleProviderInitial {
  id: number;
  name: string;
  email: string;
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
  const [id, setId] = useState<number | null>(initial?.id ?? null);

  // These setters exist for development conveniences (e.g. role-switcher).
  // In production the session flows: server validates JWT → /api/auth/login
  // sets the httpOnly cookie → router.refresh() re-renders with fresh `initial`.
  const setRole = useCallback((next: Role) => {
    setRoleState(next);
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    setName(null);
    setId(null);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({ role, name, id, setRole, clearRole }),
    [role, name, id, setRole, clearRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
