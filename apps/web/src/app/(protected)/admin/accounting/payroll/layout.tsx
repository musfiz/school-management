import { requireMenu } from "@/lib/require-menu";

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("payroll");
  return <>{children}</>;
}
