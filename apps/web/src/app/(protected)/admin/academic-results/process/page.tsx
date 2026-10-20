import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProcessView from "./ProcessView";

export const dynamic = "force-dynamic";

export default async function ResultProcessPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/process");
  }
  return <ProcessView />;
}
