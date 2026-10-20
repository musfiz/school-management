import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnalyticsView from "./AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/outputs/analytics");
  }
  return <AnalyticsView />;
}
