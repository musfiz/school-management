import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BillingView from "./BillingView";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/accounting/billing");
  }
  return <BillingView />;
}
