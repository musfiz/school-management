import type { Metadata } from "next";
import { notices } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Notice Board",
  description: "Latest notices, circulars and announcements from Model High School.",
};

export default function NoticePage() {
  const sorted = [...notices].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Notice Board"
        description="Official notices and circulars for students, parents and staff."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Notice", href: "/others/notice" },
        ]}
      />
      <Section>
        <ul className="space-y-4">
          {sorted.map((n) => (
            <li
              key={n.id}
              className="rounded-sm border border-ink-200 bg-white p-6 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-sm bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
                  {n.category}
                </span>
                <span className="text-sm text-ink-400">
                  {new Date(n.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {n.pinned && (
                  <span className="text-xs font-bold text-gold-600">★ Pinned</span>
                )}
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-navy-900">
                {n.title}
              </h3>
              <p className="mt-2 text-ink-600">{n.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
