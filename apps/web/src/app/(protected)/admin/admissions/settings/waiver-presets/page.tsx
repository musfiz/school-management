import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import WaiverPresetsView from "./WaiverPresetsView";

export const dynamic = "force-dynamic";

export default async function WaiverPresetsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/settings/waiver-presets");
  }
  return <WaiverPresetsView />;
}
