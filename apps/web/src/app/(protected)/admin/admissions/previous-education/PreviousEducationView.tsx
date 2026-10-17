"use client";

import { DashPageHeader } from "@/components/dashboard/DashPage";
import ComingSoon from "@/components/admissions/ComingSoon";

export default function PreviousEducationView() {
  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Previous Education"
        description="Plan §3.3 — SSC/Dakhil/HSC history, board GPA, TC trail"
      />
      <ComingSoon
        spec="Plan §3.3 student_previous_educations"
        status="Phase 3 · table live, rows arrive with the onboarding orchestrator"
        bullets={[
          "Exam history rows (PSC → HSC/Alim) with board, group, roll/reg, GPA.",
          "TC number + date trail for transfer-in students.",
          "Entered in wizard Step 2 (Student Identity) at admission time.",
        ]}
      />
    </div>
  );
}
