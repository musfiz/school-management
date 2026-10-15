import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DocumentsView from "./DocumentsView";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/documents");
  }
  return <DocumentsView />;
}
