import { requireMenu } from "@/lib/require-menu";

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("students");
  return <>{children}</>;
}
