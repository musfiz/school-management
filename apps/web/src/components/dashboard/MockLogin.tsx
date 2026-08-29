"use client";

import {
  roleDescriptions,
  roleLabels,
  ROLES,
  type Role,
} from "@/lib/dashboard-nav";
import { GraduationCapIcon } from "@/components/icons";
import { useRole } from "./RoleProvider";

export default function MockLogin() {
  const { setRole } = useRole();

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-xl rounded-card border border-ink-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800 text-white">
            <GraduationCapIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-navy-900">
              Model High School
            </h1>
            <p className="text-sm text-ink-500">Secure dashboard sign in</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-ink-600">
          Select your role to enter the dashboard. This is a demo gate — a real
          login (credentials / SSO) replaces this step later.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ROLES.map((role: Role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRole(role)}
              className="group rounded-xl border border-ink-200 bg-ink-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-navy-300 hover:bg-navy-50 hover:shadow-soft focus-visible:ring-2 focus-visible:ring-navy-400"
            >
              <span className="block font-display text-base font-bold text-navy-900">
                {roleLabels[role]}
              </span>
              <span className="mt-1 block text-xs text-ink-500">
                {roleDescriptions[role]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
