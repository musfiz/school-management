import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SettingsView from "./SettingsView";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/dashboard/settings");
  }
  return <SettingsView />;
}
