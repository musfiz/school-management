import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import CampaignsView from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/campaigns");
  }
  return <CampaignsView />;
}
