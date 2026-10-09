import Link from "next/link";
import { notices } from "@/lib/content/collections";
import { Section } from "./ui";
import { ArrowRightIcon } from "./icons";

/** Latest notices teaser. Still driven by the static `notices` sample data —
 *  a real `Notice` entity is separate work (see docs/feature-roadmap.md). */
export function NoticeBoard() {
  const latest = [...notices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return (
    <Section className="bg-ink-50">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-gold-600">
            Notice board
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
            Latest notices &amp; circulars
          </h2>
        </div>
        <Link
          href="/others/notice"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-brand-700"
        >
          All notices
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-8 divide-y divide-ink-200 overflow-hidden rounded-sm border border-ink-200 bg-white shadow-soft">
        {latest.map((n) => (
          <li
            key={n.id}
            className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="w-24 shrink-0 text-sm font-semibold text-brand-600">
              {new Date(n.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="hidden shrink-0 rounded-sm bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700 sm:inline">
              {n.category}
            </span>
            <Link
              href="/others/notice"
              className="flex-1 text-ink-800 transition-colors hover:text-navy-700"
            >
              {n.title}
            </Link>
            {n.pinned && (
              <span className="shrink-0 text-xs font-bold text-gold-600">Pinned</span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
