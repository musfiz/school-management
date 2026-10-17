import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SyllabusMatrixView from "./SyllabusMatrixView";

export const dynamic = "force-dynamic";

export default async function SyllabusMatrixPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/settings/syllabus-matrix");
  }
  return <SyllabusMatrixView />;
}
