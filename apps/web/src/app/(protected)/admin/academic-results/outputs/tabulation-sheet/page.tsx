import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TabulationView from "./TabulationView";

export const dynamic = "force-dynamic";

export default async function TabulationPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/academic-results/outputs/tabulation-sheet");
  }
  return <TabulationView />;
}
