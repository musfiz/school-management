import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ResultsView from "./ResultsView";

export const dynamic = "force-dynamic";

export default async function DashboardResultsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/dashboard/results");
  }
  return <ResultsView />;
}
