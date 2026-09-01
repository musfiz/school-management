"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ErrorPageProps {
  code?: number;
  title?: string;
  message?: string;
  showHome?: boolean;
}

const errorIllustrations: Record<number, { bg: string; fg: string; path: string }> = {
  404: {
    bg: "#eef2ff",
    fg: "#4f46e5",
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  },
  403: {
    bg: "#fef3c7",
    fg: "#d97706",
    path: "M12 9v4m0 4h.01M5.07 19H18.93a2 2 0 0 0 1.75-2.98L13.75 4a2 2 0 0 0-3.5 0L4.32 16.02A2 2 0 0 0 5.07 19z",
  },
  500: {
    bg: "#fee2e2",
    fg: "#dc2626",
    path: "M12 9v4m0 4h.01M5.07 19H18.93a2 2 0 0 0 1.75-2.98L13.75 4a2 2 0 0 0-3.5 0L4.32 16.02A2 2 0 0 0 5.07 19z",
  },
};

export default function DashboardErrorPage({
  code = 404,
  title,
  message,
  showHome = true,
}: ErrorPageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const illustration = errorIllustrations[code] || errorIllustrations[404];
  const defaultTitles: Record<number, string> = {
    404: "Page not found",
    403: "Access denied",
    500: "Server error",
  };
  const defaultMessages: Record<number, string> = {
    404: "The page you're looking for doesn't exist or has been moved.",
    403: "You don't have permission to access this resource.",
    500: "Something went wrong on our end. Please try again later.",
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className={`text-center transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {/* Error Illustration */}
        <div className="mx-auto mb-8">
          <div
            className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full"
            style={{ backgroundColor: illustration.bg }}
          >
            {/* Decorative ring */}
            <div className="absolute inset-2 rounded-full border-2 border-dashed" style={{ borderColor: illustration.fg + "40" }} />
            <div className="absolute inset-4 rounded-full border-2" style={{ borderColor: illustration.fg + "20" }} />

            {/* Error icon */}
            <svg
              className="h-20 w-20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={illustration.fg}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={illustration.path} />
            </svg>

            {/* Floating badge */}
            <div
              className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg"
              style={{ backgroundColor: illustration.fg }}
            >
              {code}
            </div>
          </div>
        </div>

        {/* Error content */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            {title || defaultTitles[code]}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 sm:text-base">
            {message || defaultMessages[code]}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {showHome && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Back to Dashboard
            </Link>
          )}

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Go Back
          </button>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
          >
            Contact Support
          </Link>
        </div>

        {/* Additional help text */}
        <p className="mt-8 text-xs text-slate-400">
          If you think this is a mistake, please contact your administrator.
        </p>
      </div>
    </div>
  );
}
