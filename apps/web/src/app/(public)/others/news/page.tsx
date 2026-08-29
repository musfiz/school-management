import type { Metadata } from "next";
import { news } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and stories from Model High School.",
};

export default function NewsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="School News"
        description="Stories, achievements and happenings from across campus."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "News", href: "/others/news" },
        ]}
      />
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          {news.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-sm border border-ink-200 bg-white p-6 shadow-soft"
            >
              <div className="flex items-center gap-3 text-xs font-medium text-ink-400">
                <span className="rounded-sm bg-gold-100 px-2.5 py-1 font-semibold text-navy-800">
                  News
                </span>
                <span>
                  {new Date(item.date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-bold text-navy-900">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-ink-600">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
