import { requireMenu } from "@/lib/require-menu";

export default async function VouchersLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("accounting");
  return <>{children}</>;
}
