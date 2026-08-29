"use client";

import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { teachers } from "@/lib/content/collections";

export default function StudentsView() {
  return (
    <div>
      <DashPageHeader
        title="Students"
        description="Browse and manage student records (admin / management / teacher)."
      />
      <DashCard title="Student directory">
        <p className="text-sm text-ink-500">
          A searchable student list will render here. Sample faculty shown for
          layout reference:
        </p>
        <ul className="mt-4 divide-y divide-ink-200">
          {teachers.slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3">
              <span className="font-medium text-navy-900">{t.name}</span>
              <span className="text-sm text-ink-500">{t.department}</span>
            </li>
          ))}
        </ul>
      </DashCard>
    </div>
  );
}
