"use client";

import { useEffect } from "react";
import DashboardErrorPage from "@/components/dashboard/DashboardErrorPage";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <DashboardErrorPage
      code={500}
      title="Something went wrong"
      message="We encountered an unexpected error. Please try again or return to the dashboard."
      showHome={true}
    />
  );
}
