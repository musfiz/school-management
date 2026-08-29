import type { Metadata } from "next";
import { downloads } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Download",
  description: "Download admission forms, routines and other documents.",
};

export default function DownloadPage() {
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Downloads"
        description="Forms, routines and documents in one place."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Download", href: "/others/download" },
        ]}
      />
      <Section>
        <ul className="divide-y divide-ink-200 overflow-hidden rounded-sm border border-ink-200 bg-white shadow-soft">
          {downloads.map((d) => (
            <li key={d.id}>
              <a
                href={d.url}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-ink-50"
              >
                <span className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-navy-50 text-xs font-bold text-navy-800">
                    {d.format}
                  </span>
                  <span>
                    <span className="block font-display font-semibold text-navy-900">
                      {d.title}
                    </span>
                    <span className="block text-xs text-ink-400">
                      {d.category} · {d.size} · Updated {d.updated}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                  Download
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
