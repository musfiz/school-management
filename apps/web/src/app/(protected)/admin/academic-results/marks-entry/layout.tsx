import { requireMenu } from "@/lib/require-menu";

export default async function MarksEntryLayout({ children }: { children: React.ReactNode }) {
  await requireMenu("marks_entry");
  return <>{children}</>;
}
