import { requireMenu } from "@/lib/require-menu";

export default async function ExamsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("exam_setup");
  return <>{children}</>;
}
