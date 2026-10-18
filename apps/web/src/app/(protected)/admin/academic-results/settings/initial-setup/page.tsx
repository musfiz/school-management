import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SessionsClassesView from "../sessions-classes/SessionsClassesView";

export const dynamic = "force-dynamic";

export default async function InitialSetupPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/settings/initial-setup");
  }
  return <SessionsClassesView />;
}
