import { Container } from "@/components/ui";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";

/** Route suspense boundary — same loader as the dashboard. */
export default function Loading() {
  return (
    <Container>
      <AdminPageLoader />
    </Container>
  );
}
