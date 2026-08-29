"use client";

import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function DashboardSettings() {
  return (
    <div>
      <DashPageHeader
        title="Settings"
        description="Portal configuration (admin / management)."
      />
      <DashCard title="Preferences">
        <p className="text-sm text-ink-500">
          Theme, notifications and access controls will be configured here once
          connected to a real backend.
        </p>
      </DashCard>
    </div>
  );
}
