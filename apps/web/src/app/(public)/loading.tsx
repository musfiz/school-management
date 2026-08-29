import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container>
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-sm border-4 border-ink-200 border-t-navy-700" />
      </div>
    </Container>
  );
}
