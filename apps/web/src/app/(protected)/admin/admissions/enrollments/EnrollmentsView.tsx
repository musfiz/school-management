"use client";

import { DashPageHeader } from "@/components/dashboard/DashPage";
import ComingSoon from "@/components/admissions/ComingSoon";

export default function EnrollmentsView() {
  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Enrollments & Sections"
        description="Plan §3.4 — roll generator, section transfer, residence & quota tags"
      />
      <ComingSoon
        spec="Plan §3.4 student_enrollments"
        status="Phase 3 · table + uniqueness guards live, placement UI not built yet"
        bullets={[
          "Session-wise placement: class, shift, section, group, auto roll preview.",
          "Section transfer + residence (day/hostel/Lillah) + quota tags.",
          "Rows are written by Direct Admission confirm (Workflow 4).",
        ]}
      />
    </div>
  );
}
