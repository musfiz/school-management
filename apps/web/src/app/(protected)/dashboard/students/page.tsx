import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import StudentsView from "./StudentsView";

export const dynamic = "force-dynamic";

export default async function DashboardStudentsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/dashboard/students");
  }
  return <StudentsView />;
}
