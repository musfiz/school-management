import { requireMenu } from "@/lib/require-menu";

export default async function CollectionLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("fees");
  return <>{children}</>;
}
