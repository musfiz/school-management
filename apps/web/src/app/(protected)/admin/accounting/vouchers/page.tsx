import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import VouchersView from "./VouchersView";

export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/accounting/vouchers");
  }
  return <VouchersView />;
}
