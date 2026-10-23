import { requireMenu } from "@/lib/require-menu";

export default async function FamiliesLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("student_registry");
  return <>{children}</>;
}
