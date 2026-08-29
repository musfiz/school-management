import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { overviewByRole } from "@/lib/dashboard-overview";
import { roleLabels } from "@/lib/dashboard-nav";
import {
  DashCard,
  DashPageHeader,
  StatGrid,
} from "@/components/dashboard/DashPage";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  // Layout already gates, but be defensive so a direct hit to this server
  // component never renders with a null session.
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/dashboard");
  }

  const data = overviewByRole[session.role];

  return (
    <div>
      <DashPageHeader
        title={`Welcome, ${session.name}`}
        description={`${data.subtitle} Signed in as ${roleLabels[session.role]}.`}
      />
      <StatGrid items={data.stats} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DashCard title="Quick actions">
          <ul className="space-y-2 text-sm">
            {data.quickActions.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="inline-flex items-center gap-1.5 text-navy-700 transition-colors hover:text-navy-900"
                >
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                  {a.label}
                </Link>
              </li>
            ))}
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
