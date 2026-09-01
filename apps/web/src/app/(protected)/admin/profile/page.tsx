import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfileView from "./ProfileView";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/profile");
  }
  return <ProfileView />;
}
