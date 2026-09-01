import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TeachersView from "./TeachersView";

export const dynamic = "force-dynamic";

export default async function DashboardTeachersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/teachers");
  }
  return <TeachersView />;
}
