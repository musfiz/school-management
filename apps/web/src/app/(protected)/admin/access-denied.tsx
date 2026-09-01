import DashboardErrorPage from "@/components/dashboard/DashboardErrorPage";

export default function AccessDenied() {
  return (
    <DashboardErrorPage
      code={403}
      title="Access Denied"
      message="You don't have permission to access this page. This area is restricted to authorized personnel only."
    />
  );
}
