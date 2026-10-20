import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MarksEntryView from "./MarksEntryView";

export const dynamic = "force-dynamic";

export default async function MarksEntryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/marks-entry");
  }
  return <MarksEntryView />;
}
