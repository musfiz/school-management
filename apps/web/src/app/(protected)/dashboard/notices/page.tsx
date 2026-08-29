import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NoticesView from "./NoticesView";

export const dynamic = "force-dynamic";

export default async function DashboardNoticesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/dashboard/notices");
  }
  return <NoticesView />;
}
