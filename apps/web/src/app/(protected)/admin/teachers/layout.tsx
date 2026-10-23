import { requireMenu } from "@/lib/require-menu";

export default async function TeachersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("teachers");
  return <>{children}</>;
}
