import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import MarksheetsView from "./MarksheetsView";

export const dynamic = "force-dynamic";

export default async function MarksheetsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/outputs/marksheets");
  }
  return <MarksheetsView />;
}
