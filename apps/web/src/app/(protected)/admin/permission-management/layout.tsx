import { requireMenu } from "@/lib/require-menu";

export default async function PermissionManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("permission_management");
  return <>{children}</>;
}
