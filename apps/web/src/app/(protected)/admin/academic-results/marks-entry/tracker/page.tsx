import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TrackerView from "./TrackerView";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/marks-entry/tracker");
  }
  return <TrackerView />;
}
