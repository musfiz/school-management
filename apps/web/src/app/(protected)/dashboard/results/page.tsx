"use client";

import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";

export default function DashboardResults() {
  return (
    <div>
      <DashPageHeader
        title="Results"
        description="View and manage examination results."
      />
      <DashCard title="Result lookup">
        <p className="text-sm text-ink-500">
          Enter a class and roll to look up a result. The same lookup used on the
          public site is available here for staff and families.
        </p>
        <a
          href="/result/exam-result"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy-800 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-900"
        >
          Open result lookup
        </a>
      </DashCard>
    </div>
  );
}
