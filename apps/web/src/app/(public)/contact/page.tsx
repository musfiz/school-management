import type { Metadata } from "next";
import { site } from "@/lib/site";
import { MailIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { Container, JsonLd, PageHeader, Section } from "@/components/ui";
import { articleJsonLd } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${site.name}. Address, phone, email and office hours.`,
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          title: "Contact",
          description: `Contact ${site.name}`,
          url: "/contact",
        })}
      />
      <PageHeader
        eyebrow="Contact"
        title="We'd love to hear from you"
        description="Reach the school office for admissions, results, or a campus visit. A real person answers every message."
      />

      <Section>
        <div className="grid gap-10 rounded-card border border-ink-200 bg-white p-8 shadow-soft sm:p-12 lg:grid-cols-2">
          <div>
            <ul className="space-y-5">
              <li className="flex items-start gap-3 text-ink-700">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <PinIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">Address</span>
                  {site.address}
                </span>
              </li>
              <li className="flex items-start gap-3 text-ink-700">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <PhoneIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">Phone</span>
                  <a href={`tel:${site.phone}`} className="hover:text-navy-700">
                    {site.phone}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3 text-ink-700">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <MailIcon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">Email</span>
                  <a href={`mailto:${site.email}`} className="hover:text-navy-700">
                    {site.email}
                  </a>
                </span>
              </li>
            </ul>

            <div className="mt-8 flex flex-wrap gap-2">
              {["Mon–Thu 8:00am – 4:00pm", "Fri 8:00am – 12:30pm", "Office: Admin Block"].map(
                (badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-500"
                  >
                    {badge}
                  </span>
                ),
              )}
            </div>

            {/* Map placeholder (swap for an embedded map) */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 p-8 text-center text-sm text-ink-400">
              Campus map · {site.address}
            </div>
          </div>

          <form
            className="grid gap-4 rounded-2xl border border-ink-200 bg-ink-50 p-6"
            action="#"
            method="post"
          >
            <label className="text-sm font-semibold text-ink-700">
              Your name
              <input
                type="text"
                name="name"
                required
                placeholder="Full name"
                className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="text-sm font-semibold text-ink-700">
              Email
              <input
                type="email"
                name="email"
                required
                placeholder="you@email.com"
                className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="text-sm font-semibold text-ink-700">
              Subject
              <input
                type="text"
                name="subject"
                placeholder="How can we help?"
                className="mt-1.5 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="text-sm font-semibold text-ink-700">
              Message
              <textarea
                name="message"
                rows={5}
                required
                placeholder="Write your message…"
                className="mt-1.5 w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-normal text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <button
              type="submit"
              className="mt-1 inline-flex items-center justify-center rounded-xl bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-navy-900"
            >
              Send message
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}
