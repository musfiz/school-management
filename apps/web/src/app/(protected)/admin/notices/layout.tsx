import { requireMenu } from "@/lib/require-menu";

export default async function NoticesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("website");
  return <>{children}</>;
}
