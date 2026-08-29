"use client";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {/* Animated spinner */}
        <div className="relative mx-auto h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <div className="absolute inset-2 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-400" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        </div>

        {/* Loading text */}
        <div className="mt-6 space-y-1">
          <p className="text-sm font-semibold text-slate-700">Loading...</p>
          <p className="text-xs text-slate-400">Preparing your dashboard</p>
        </div>

        {/* Skeleton loaders */}
        <div className="mt-8 space-y-3">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
