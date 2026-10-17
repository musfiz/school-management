import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MeritListView from "./MeritListView";

export const dynamic = "force-dynamic";

export default async function MeritListPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/outputs/merit-list");
  }
  return <MeritListView />;
}
