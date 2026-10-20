import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AutoSyncView from "./AutoSyncView";

export const dynamic = "force-dynamic";

export default async function AutoSyncPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/marks-entry/auto-sync");
  }
  return <AutoSyncView />;
}
