import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-5xl font-extrabold text-navy-800">404</p>
      <h1 className="mt-3 font-display text-xl font-bold text-navy-900">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-ink-600">
        This dashboard page does not exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-800 px-5 py-3 text-sm font-semibold text-white hover:bg-navy-900"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
