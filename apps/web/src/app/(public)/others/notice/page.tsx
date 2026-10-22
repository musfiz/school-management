import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import { notices as fallbackNotices } from "@/lib/content/collections";
import type { NoticeItem } from "@/lib/notices";
import { resolveImageUrl } from "@/lib/media";
import { FiDownload, FiExternalLink, FiMapPin } from "react-icons/fi";

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
      <PageHeader eyebrow="Others" title="Notice Board" className="py-6 sm:py-8" />
      <Breadcrumbs
        className="py-1.5"
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Notice", href: "/others/notice" },
        ]}
      />
      <Section className="py-6! sm:py-8!">
        {apiNotices.length > 0 ? (
          <div className="overflow-x-auto rounded-xs border border-ink-200 bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">SI</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Notice</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-center font-semibold">Download</th>
                  <th className="px-4 py-3 text-center font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {apiNotices.map((n, i) => {
                  const title = (locale === "bn" && n.titleBn) || n.title;
                  const shortDesc = (locale === "bn" && n.shortDescriptionBn) || n.shortDescription;
                  const dateStr = n.publishDate || n.createdAt;

                  return (
                    <tr key={n.id} className="align-top hover:bg-ink-50">
                      <td className="px-4 py-3 text-ink-500">{i + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-500">
                        {dateStr
                          ? new Date(dateStr).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {n.isPinned && (
                            <FiMapPin
                              title="Pinned"
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-600"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-navy-900">{title}</p>
                            {shortDesc && (
                              <p className="mt-0.5 line-clamp-2 text-ink-500">{shortDesc}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-xs bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
                          {n.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {n.pdfUrl ? (
                          <a
                            href={resolveImageUrl(n.pdfUrl)}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF"
                            className="inline-flex items-center justify-center rounded-xs p-1.5 text-red-600 transition-colors hover:bg-red-50"
                          >
                            <FiDownload className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/others/notice/${n.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xs border border-ink-200 px-2.5 py-1 text-xs font-semibold text-navy-700 transition-colors hover:border-brand-400 hover:text-brand-600"
                        >
                          View details
                          <FiExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xs border border-ink-200 bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">SI</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Notice</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-center font-semibold">Download</th>
                  <th className="px-4 py-3 text-center font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {fallbackNotices.map((n, i) => (
                  <tr key={n.id} className="align-top hover:bg-ink-50">
                    <td className="px-4 py-3 text-ink-500">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-500">
                      {new Date(n.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {n.pinned && (
                          <FiMapPin
                            title="Pinned"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-600"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-navy-900">{n.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-ink-500">{n.body}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-xs bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
                        {n.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-ink-300">—</td>
                    <td className="px-4 py-3 text-center text-ink-300">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
