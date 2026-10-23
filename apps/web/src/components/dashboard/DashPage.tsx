import type { ReactNode } from "react";

export function DashPageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-xl font-extrabold text-navy-900 sm:text-2xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {(actions || children) && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

export function DashCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xs border border-ink-200 bg-white p-4 shadow-soft ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 className="font-display text-base font-bold text-navy-900">{title}</h2>
          )}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
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
          className="rounded-xs border border-ink-200 bg-white p-4 shadow-soft"
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
