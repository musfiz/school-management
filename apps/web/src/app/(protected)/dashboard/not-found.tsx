import DashboardErrorPage from "@/components/dashboard/DashboardErrorPage";

export default function DashboardNotFound() {
  return (
    <DashboardErrorPage
      code={404}
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved. Please check the URL or navigate back to the dashboard."
    />
  );
}
