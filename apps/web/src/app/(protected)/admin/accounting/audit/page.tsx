import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuditTrailView from "./AuditTrailView";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/accounting/audit");
  }
  return <AuditTrailView />;
}
