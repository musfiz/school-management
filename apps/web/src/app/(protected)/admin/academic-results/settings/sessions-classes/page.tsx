import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SessionsClassesView from "./SessionsClassesView";

export const dynamic = "force-dynamic";

export default async function SessionsClassesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/settings/sessions-classes");
  }
  return <SessionsClassesView />;
}
