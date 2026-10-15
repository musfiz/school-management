import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ChartOfAccountsView from "./ChartOfAccountsView";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/accounting/chart-of-accounts");
  }
  return <ChartOfAccountsView />;
}
