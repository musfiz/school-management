import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PromotionTcView from "./PromotionTcView";

export const dynamic = "force-dynamic";

export default async function PromotionTcPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/promotion-tc");
  }
  return <PromotionTcView />;
}
