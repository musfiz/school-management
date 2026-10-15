import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

export default async function AccountingReportsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/accounting/reports");
  }
  return <ReportsView />;
}
