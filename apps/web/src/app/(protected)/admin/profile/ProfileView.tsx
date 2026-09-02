"use client";

import { roleLabels, type Role } from "@/lib/dashboard-nav";
import { useRole } from "@/components/dashboard/RoleProvider";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { site } from "@/lib/site";

export default function ProfileView() {
  const { role } = useRole();
  const r = (role ?? "guest") as Role;

  return (
    <div>
      <DashPageHeader title="Profile" />
      <DashCard title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-400">Role</dt>
            <dd className="text-ink-800">{roleLabels[r]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-400">School</dt>
            <dd className="text-ink-800">{site.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-400">Email</dt>
            <dd className="text-ink-800">{site.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-400">Status</dt>
            <dd className="text-ink-800">Active (demo)</dd>
          </div>
        </dl>
      </DashCard>
    </div>
  );
}
