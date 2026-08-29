"use client";

import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { notices } from "@/lib/content/collections";

export default function DashboardNotices() {
  const sorted = [...notices].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <DashPageHeader
        title="Notices"
        description="Publish and manage notices for students and parents."
      />
      <DashCard title={`Recent notices (${sorted.length})`}>
        <ul className="space-y-3">
          {sorted.map((n) => (
            <li key={n.id} className="rounded-lg border border-ink-200 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
                  {n.category}
                </span>
                <span className="text-xs text-ink-400">{n.date}</span>
              </div>
              <p className="mt-1.5 text-sm text-ink-700">{n.title}</p>
            </li>
          ))}
        </ul>
      </DashCard>
    </div>
  );
}
