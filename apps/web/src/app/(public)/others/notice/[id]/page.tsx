import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import type { NoticeItem } from "@/lib/notices";
import { resolveImageUrl } from "@/lib/media";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { FiDownload, FiFileText, FiMapPin } from "react-icons/fi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function getNotice(id: string): Promise<NoticeItem | null> {
  try {
    const res = await fetch(`${API_BASE}/notices/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const notice = await getNotice(id);
  return {
    title: notice ? notice.title : "Notice",
    description: notice?.shortDescription ?? "Notice details.",
  };
}

export default async function NoticeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [locale, notice] = await Promise.all([getLocale(), getNotice(id)]);

  if (!notice) notFound();

  const title = (locale === "bn" && notice.titleBn) || notice.title;
  const shortDesc = (locale === "bn" && notice.shortDescriptionBn) || notice.shortDescription;
  const description = (locale === "bn" && notice.descriptionBn) || notice.description;
  const dateStr = notice.publishDate || notice.createdAt;
  const pdfUrl = notice.pdfUrl ? resolveImageUrl(notice.pdfUrl) : null;

  return (
    <>
      <PageHeader
        eyebrow="Notice"
        title={title}
        description={shortDesc ?? undefined}
        className="py-6 sm:py-8"
      />
      <Breadcrumbs
        className="py-1.5"
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Notice", href: "/others/notice" },
          { name: title, href: `/others/notice/${notice.id}` },
        ]}
      />
      <Section>
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xs border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xs bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
                  {notice.category}
                </span>
                {notice.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-xs bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                    <FiMapPin className="h-3 w-3 fill-amber-500 text-amber-600" />
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

            <h1 className="mt-5 font-display text-2xl font-bold text-navy-900 sm:text-3xl">
              {title}
            </h1>

            {shortDesc && <p className="mt-3 text-base font-medium text-ink-600">{shortDesc}</p>}

            {description && (
              <div
                className="cms-rich mt-5 text-sm leading-relaxed text-ink-700"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
              />
            )}

            {pdfUrl && (
              <div className="mt-8 border-t border-ink-100 pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                    <FiFileText className="h-4 w-4" />
                    Official Notice (PDF)
                  </h2>
                  <a
                    href={pdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xs bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <FiDownload className="h-4 w-4" />
                    Download PDF
                  </a>
                </div>
                <div className="overflow-hidden rounded-xs border border-ink-200 bg-ink-50">
                  <iframe
                    src={`${pdfUrl}#toolbar=1`}
                    title={`${title} — PDF`}
                    className="h-[75vh] w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <a
              href="/others/notice"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-brand-600"
            >
              ← Back to Notice Board
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
