import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import DirectAdmissionView from "./DirectAdmissionView";

export const dynamic = "force-dynamic";

export default async function DirectAdmissionPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?returnTo=/admin/admissions/direct-admission");
  }
  return (
    <Suspense fallback={<AdminPageLoader />}>
      <DirectAdmissionView />
    </Suspense>
  );
}
