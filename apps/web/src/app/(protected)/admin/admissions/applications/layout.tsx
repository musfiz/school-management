import { requireMenu } from "@/lib/require-menu";

export default async function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("admission");
  return <>{children}</>;
}
