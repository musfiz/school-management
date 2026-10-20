import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ExamsView from "./ExamsView";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/exams");
  }
  return <ExamsView />;
}
