import Link from "next/link";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import { FiAlertCircle, FiArrowLeft, FiHome } from "react-icons/fi";

export const dynamic = "force-dynamic";

export default function ForbiddenPage() {
  return (
    <div className="space-y-4">
      <DashPageHeader
        title="403 — Forbidden"
        description="Access to this page is restricted by your assigned roles and menu permissions."
      />

      <DashCard title="Access Restricted">
        <div className="max-w-xl space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xs border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">Permission Required</p>
              <p className="mt-0.5 text-amber-800">
                You do not have permission to view this section. If you believe this is an error,
                please contact your institutional administrator to request access.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Link
              href="/admin"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <FiHome className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <Link
              href="/admin"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xs border border-ink-200 bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50"
            >
              <FiArrowLeft className="h-3.5 w-3.5" />
              <span>Return</span>
            </Link>
          </div>
        </div>
      </DashCard>
    </div>
  );
}
