import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AddPermissionPage() {
  redirect("/admin/permission-management/menus");
}
