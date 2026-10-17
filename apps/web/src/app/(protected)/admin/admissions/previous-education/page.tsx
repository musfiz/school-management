import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PreviousEducationView from "./PreviousEducationView";

export const dynamic = "force-dynamic";

export default async function PreviousEducationPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/previous-education");
  }
  return <PreviousEducationView />;
}
