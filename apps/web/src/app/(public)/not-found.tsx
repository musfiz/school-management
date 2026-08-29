import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <Container>
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="font-display text-6xl font-extrabold text-navy-800">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-navy-900">
          Page not found
        </h1>
        <p className="mt-2 max-w-md text-ink-600">
          The page you are looking for may have moved or no longer exists.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-sm bg-navy-800 px-6 py-3 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
        >
          Back to home
        </Link>
      </div>
    </Container>
  );
}
