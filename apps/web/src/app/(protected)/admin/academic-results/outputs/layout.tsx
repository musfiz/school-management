import { requireMenu } from "@/lib/require-menu";

export default async function OutputsLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("marksheets");
  return <>{children}</>;
}
