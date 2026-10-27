import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RoutineManagementView from "./RoutineManagementView";

export const dynamic = "force-dynamic";

export default async function RoutineManagementPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/others/routine");
  }
  return <RoutineManagementView />;
}
