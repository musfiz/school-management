import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import GradingScalesView from "./GradingScalesView";

export const dynamic = "force-dynamic";

export default async function GradingScalesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/settings/grading-scales");
  }
  return <GradingScalesView />;
}
