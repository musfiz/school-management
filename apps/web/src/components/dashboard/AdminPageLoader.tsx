"use client";

export default function AdminPageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="relative mx-auto h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <div
            className="absolute inset-2 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-400"
            style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
          />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-600">Loading…</p>
      </div>
    </div>
  );
}
