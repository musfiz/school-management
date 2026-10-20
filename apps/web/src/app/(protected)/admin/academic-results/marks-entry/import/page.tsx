import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ImportView from "./ImportView";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/marks-entry/import");
  }
  return <ImportView />;
}
