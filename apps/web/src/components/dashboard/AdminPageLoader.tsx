"use client";

export default function AdminPageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <div
          className="absolute inset-2 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-400"
          style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
        />
      </div>
    </div>
  );
}
