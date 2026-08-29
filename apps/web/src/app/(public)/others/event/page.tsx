import type { Metadata } from "next";
import { events } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import { CalendarIcon, PinIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming events at Model High School.",
};

export default function EventPage() {
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Events"
        description="Mark your calendar for what's coming up on campus."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Event", href: "/others/event" },
        ]}
      />
      <Section>
        <div className="space-y-4">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-4 rounded-card border border-ink-200 bg-white p-6 shadow-soft sm:flex-row sm:items-center"
            >
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-navy-800 text-white">
                <span className="text-xs font-medium text-navy-100">
                  {new Date(e.date).toLocaleDateString("en-GB", { month: "short" })}
                </span>
                <span className="font-display text-2xl font-extrabold">
                  {new Date(e.date).getDate()}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-navy-900">
                  {e.title}
                </h3>
                <p className="mt-1 text-ink-600">{e.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-brand-600" />
                    {new Date(e.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PinIcon className="h-4 w-4 text-brand-600" />
                    {e.venue}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
