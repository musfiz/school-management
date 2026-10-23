import { requireMenu } from "@/lib/require-menu";

export default async function EnrollmentsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("enrollment");
  return <>{children}</>;
}
