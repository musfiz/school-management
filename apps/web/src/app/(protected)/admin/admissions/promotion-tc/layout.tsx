import { requireMenu } from "@/lib/require-menu";

export default async function PromotionTcLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("enrollment");
  return <>{children}</>;
}
