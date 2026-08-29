"use client";

import { roleLabels, type Role } from "@/lib/dashboard-nav";
import { useRole } from "@/components/dashboard/RoleProvider";
import {
  DashCard,
  DashPageHeader,
  StatGrid,
} from "@/components/dashboard/DashPage";

export default function DashboardOverview() {
  const { role } = useRole();
  const r = (role ?? "guest") as Role;

  return (
    <div>
      <DashPageHeader
        title={`Welcome, ${roleLabels[r]}`}
        description="Here is a snapshot of your dashboard. Use the menu to jump into a module."
      />
      <StatGrid
        items={[
          { value: "2,400", label: "Students" },
          { value: "96", label: "Teachers" },
          { value: "12", label: "New notices" },
          { value: "98%", label: "Attendance" },
        ]}
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DashCard title="Quick actions">
          <ul className="space-y-2 text-sm text-ink-700">
            <li>• Review today&apos;s notices</li>
            <li>• Check recent results</li>
            <li>• Update your profile</li>
          </ul>
        </DashCard>
        <DashCard title="Recent activity">
          <p className="text-sm text-ink-500">
            Activity feed will appear here once connected to the backend.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
