import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import EnrollmentsView from "./EnrollmentsView";

export const dynamic = "force-dynamic";

export default async function EnrollmentsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/enrollments");
  }
  return <EnrollmentsView />;
}
