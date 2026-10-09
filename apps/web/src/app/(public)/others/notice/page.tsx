import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import { notices as fallbackNotices } from "@/lib/content/collections";
import type { NoticeItem } from "@/lib/notices";
import { resolveImageUrl } from "@/lib/media";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { FileText, Pin } from "lucide-react";

export const metadata: Metadata = {
  title: "Notice Board",
  description: "Latest notices, circulars and announcements from Model High School.",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function getPublishedNotices(): Promise<NoticeItem[]> {
  try {
    const res = await fetch(`${API_BASE}/notices`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function NoticePage() {
  const locale = await getLocale();
  const apiNotices = await getPublishedNotices();

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
        {apiNotices.length > 0 ? (
          <ul className="space-y-6">
            {apiNotices.map((n) => {
              const title = (locale === "bn" && n.titleBn) || n.title;
              const shortDesc =
                (locale === "bn" && n.shortDescriptionBn) || n.shortDescription;
              const description =
                (locale === "bn" && n.descriptionBn) || n.description;
              const dateStr = n.publishDate || n.createdAt;

              return (
                <li
                  key={n.id}
                  className="rounded-xl border border-ink-200 bg-white p-6 shadow-soft transition-all hover:shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-sm bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
                        {n.category}
                      </span>
                      {n.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                          <Pin className="h-3 w-3 fill-amber-500 text-amber-600" />
                          Pinned
                        </span>
                      )}
                    </div>
                    {dateStr && (
                      <span className="text-sm font-medium text-ink-500">
                        {new Date(dateStr).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-display text-xl font-bold text-navy-900">
                    {title}
                  </h3>

                  {shortDesc && (
                    <p className="mt-2 text-base font-medium text-ink-600">
                      {shortDesc}
                    </p>
                  )}

                  {description && (
                    <div
                      className="cms-rich mt-4 text-sm leading-relaxed text-ink-700"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                    />
                  )}

                  {(n.pdfUrl || n.imageUrl) && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
                      {n.pdfUrl && (
                        <a
                          href={resolveImageUrl(n.pdfUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-md bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                        >
                          <FileText className="h-4 w-4" />
                          Download Official Notice (PDF)
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-4">
            {fallbackNotices.map((n) => (
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
        )}
      </Section>
    </>
  );
}
