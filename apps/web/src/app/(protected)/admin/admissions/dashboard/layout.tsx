import { requireMenu } from "@/lib/require-menu";

export default async function AdmissionDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("admission");
  return <>{children}</>;
}
