"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Role } from "@/lib/dashboard-nav";

interface RoleContextValue {
  role: Role | null;
  ready: boolean;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const COOKIE = "mhs_role";

function readCookie(): Role | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`));
  return match ? (match.split("=")[1] as Role) : null;
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRoleState(readCookie());
    setReady(true);
  }, []);

  const setRole = useCallback((next: Role) => {
    document.cookie = `${COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    setRoleState(next);
  }, []);

  const clearRole = useCallback(() => {
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    setRoleState(null);
  }, []);

  return (
    <RoleContext.Provider value={{ role, ready, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
