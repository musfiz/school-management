"use client";

import AdminPageLoader from "@/components/dashboard/AdminPageLoader";

/** Route suspense boundary — same loader as every in-view fetch. */
export default function DashboardLoading() {
  return <AdminPageLoader />;
}
