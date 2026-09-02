import type { ReactNode } from "react";

export function DashPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-xl font-extrabold text-navy-900 sm:text-2xl">
        {title}
      </h1>
      {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
    </div>
  );
}

export function DashCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-sm border border-ink-200 bg-white p-4 shadow-soft ${className}`}>
      {title && (
        <h2 className="mb-3 font-display text-base font-bold text-navy-900">{title}</h2>
      )}
      {children}
    </div>
  );
}

export function StatGrid({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-sm border border-ink-200 bg-white p-4 shadow-soft"
        >
          <p className="font-display text-2xl font-extrabold text-navy-800">
            {s.value}
          </p>
          <p className="mt-1 text-sm text-ink-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
