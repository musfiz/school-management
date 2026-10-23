import { requireMenu } from "@/lib/require-menu";

export default async function WebsiteManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("website");
  return <>{children}</>;
}
