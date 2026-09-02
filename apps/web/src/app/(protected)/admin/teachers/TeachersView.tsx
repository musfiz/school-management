"use client";

import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { teachers } from "@/lib/content/collections";

export default function TeachersView() {
  const current = teachers.filter((t) => t.status === "current");
  return (
    <div>
      <DashPageHeader title="Teachers" />
      <DashCard title={`Faculty (${current.length})`}>
        <ul className="divide-y divide-ink-200">
          {current.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3">
              <span className="font-medium text-navy-900">{t.name}</span>
              <span className="text-sm text-ink-500">{t.designation}</span>
            </li>
          ))}
        </ul>
      </DashCard>
    </div>
  );
}
