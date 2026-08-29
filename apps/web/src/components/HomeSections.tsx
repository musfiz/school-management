import Link from "next/link";
import { notices } from "@/lib/content/collections";
import { Container, Section } from "./ui";
import { ArrowRightIcon } from "./icons";

export function AboutPreview() {
  return (
    <Section className="bg-white">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-gold-600">
            About us
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-navy-900 sm:text-4xl">
            A half-century of shaping bright futures
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-600">
            Since {new Date().getFullYear() - 54}, {`Model High School`} has been a
            cornerstone of the community — combining academic excellence with the
            values of discipline, curiosity and service.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Caring, experienced faculty for every subject",
              "Modern labs, library and a safe campus",
              "Free tuition with support for those who need it",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-ink-700">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-gold-500 text-navy-900">
                  <ArrowRightIcon className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/about/about-us"
            className="mt-8 inline-flex items-center gap-2 rounded-sm bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
          >
            Learn our story
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { v: "2,400+", l: "Students" },
            { v: "96", l: "Teachers" },
            { v: "12k+", l: "Library books" },
            { v: "98%", l: "Pass rate" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-sm border border-ink-200 bg-ink-50 p-6 text-center shadow-soft"
            >
              <p className="font-display text-3xl font-extrabold text-brand-600">
                {s.v}
              </p>
              <p className="mt-1 text-sm font-medium text-ink-500">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

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
