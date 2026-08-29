"use client";

import { useState } from "react";
import type { ResultRow } from "@/lib/content/types";

const CLASSES = ["VI", "VII", "VIII", "IX", "X"];

export default function ResultLookup() {
  const [cls, setCls] = useState("VI");
  const [roll, setRoll] = useState("");
  const [result, setResult] = useState<ResultRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/result?class=${encodeURIComponent(cls)}&roll=${encodeURIComponent(roll)}`,
      );
      const data = await res.json();
      if (res.ok && data) setResult(data as ResultRow);
      else setError(data?.error ?? "Result not found. Please check your inputs.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-6 shadow-soft">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold text-ink-700">
          Class
          <select
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            className="mt-1.5 w-full rounded-sm border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink-700">
          Roll number
          <input
            type="number"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            placeholder="e.g. 1001"
            required
            className="mt-1.5 w-full rounded-sm border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-sm bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900 disabled:opacity-60"
        >
          {loading ? "Searching…" : "View result"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 overflow-hidden rounded-sm border border-brand-200 bg-brand-50">
          <div className="flex items-center justify-between bg-navy-800 px-5 py-3 text-white">
            <span className="font-display text-lg font-bold">{result.name}</span>
            <span className="text-sm text-navy-100">
              Class {result.class} · Roll {result.roll}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-px bg-brand-200">
            <div className="bg-brand-50 px-5 py-4 text-center">
              <dt className="text-xs font-semibold text-ink-500">GPA</dt>
              <dd className="font-display text-2xl font-extrabold text-navy-900">
                {result.gpa.toFixed(2)}
              </dd>
            </div>
            <div className="bg-brand-50 px-5 py-4 text-center">
              <dt className="text-xs font-semibold text-ink-500">Grade</dt>
              <dd className="font-display text-2xl font-extrabold text-navy-900">
                {result.grade}
              </dd>
            </div>
            <div className="bg-brand-50 px-5 py-4 text-center">
              <dt className="text-xs font-semibold text-ink-500">Year</dt>
              <dd className="font-display text-2xl font-extrabold text-navy-900">
                {result.year}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
