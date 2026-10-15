import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ApplicationsView from "./ApplicationsView";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/applications");
  }
  return <ApplicationsView />;
}
