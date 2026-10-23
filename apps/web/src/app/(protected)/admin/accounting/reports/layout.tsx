import { requireMenu } from "@/lib/require-menu";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("reports");
  return <>{children}</>;
}
