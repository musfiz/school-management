"use client";

import { DashPageHeader } from "@/components/dashboard/DashPage";
import ComingSoon from "@/components/admissions/ComingSoon";

export default function RequiredDocsView() {
  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Required Documents"
        description="Plan §2 settings — per-class required-document checklist"
      />
      <ComingSoon
        spec="Plan §2 settings checklist"
        status="Settings · checklist config not built yet"
        bullets={[
          "Per-class required list (e.g. Class 11 needs SSC marksheet original).",
          "Enforced in Documents & Verification at admission time.",
          "Madrasah orphan-cert requirement for Lillah boarding.",
        ]}
      />
    </div>
  );
}
