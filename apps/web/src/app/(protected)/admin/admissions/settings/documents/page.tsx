import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RequiredDocsView from "./RequiredDocsView";

export const dynamic = "force-dynamic";

export default async function RequiredDocsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/settings/documents");
  }
  return <RequiredDocsView />;
}
