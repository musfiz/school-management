import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FamiliesView from "./FamiliesView";

export const dynamic = "force-dynamic";

export default async function FamiliesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/families");
  }
  return <FamiliesView />;
}
