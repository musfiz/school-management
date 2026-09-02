import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import UserPermissionsView from "./UserPermissionsView";

export const dynamic = "force-dynamic";

export default async function UserPermissionsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/permission-management/user-permissions");
  }
  return <UserPermissionsView />;
}
