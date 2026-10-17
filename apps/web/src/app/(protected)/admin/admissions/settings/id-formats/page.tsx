import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import IdFormatsView from "./IdFormatsView";

export const dynamic = "force-dynamic";

export default async function IdFormatsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/settings/id-formats");
  }
  return <IdFormatsView />;
}
