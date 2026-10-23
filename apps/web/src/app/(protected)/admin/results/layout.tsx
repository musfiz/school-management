import { requireMenu } from "@/lib/require-menu";

export default async function ResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMenu("results");
  return <>{children}</>;
}
