import { requireMenu } from "@/lib/require-menu";

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("fees");
  return <>{children}</>;
}
