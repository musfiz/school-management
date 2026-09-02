import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AddPermissionView from "./AddPermissionView";

export const dynamic = "force-dynamic";

export default async function AddPermissionPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/permission-management/add-permission");
  }
  return <AddPermissionView />;
}
