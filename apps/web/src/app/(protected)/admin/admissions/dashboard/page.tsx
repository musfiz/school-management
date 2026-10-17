import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdmissionDashboardView from "./AdmissionDashboardView";

export const dynamic = "force-dynamic";

export default async function AdmissionDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/dashboard");
  }
  return <AdmissionDashboardView />;
}
