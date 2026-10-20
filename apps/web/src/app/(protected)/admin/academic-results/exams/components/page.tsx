import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ComponentsView from "./ComponentsView";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/exams/components");
  }
  return <ComponentsView />;
}
