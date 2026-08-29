import Link from "next/link";
import { site, footerStats, quickLinks } from "@/lib/site";
import { ArrowRightIcon, CalendarIcon, PhoneIcon } from "./icons";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-50 via-ink-50 to-ink-50" />
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      <div className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-300/40 blur-3xl" />
      <div className="absolute -left-24 top-40 -z-10 h-72 w-72 rounded-full bg-gold-300/30 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20 lg:pb-20 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white/70 px-3 py-1 text-sm font-semibold text-navy-700 shadow-soft">
            <span className="flex h-2 w-2 rounded-full bg-gold-500" />
            Admission open for {new Date().getFullYear()}–{new Date().getFullYear() + 1}
          </span>

          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] text-navy-900 sm:text-5xl lg:text-6xl">
            Knowledge. Discipline.
            <span className="block text-brand-600">Excellence.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
            {site.name} is a public secondary school where rigorous academics, caring
            teachers and a vibrant community help every student thrive.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admission/how-to-apply"
              className="inline-flex items-center gap-2 rounded-xl bg-navy-800 px-6 py-3.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-navy-900"
            >
              Apply for admission
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/result/exam-result"
              className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-6 py-3.5 text-sm font-semibold text-navy-800 shadow-soft transition-colors hover:border-navy-300 hover:bg-navy-50"
            >
              Check result
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-ink-500">
            <span className="inline-flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-brand-600" />
              Open house: Sep 19 · 10am
            </span>
            <a
              href={`tel:${site.phone}`}
              className="inline-flex items-center gap-2 hover:text-navy-700"
            >
              <PhoneIcon className="h-5 w-5 text-brand-600" />
              {site.phone}
            </a>
          </div>
        </div>

        {/* Stats */}
        <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-ink-200 bg-ink-200 shadow-card sm:grid-cols-4">
          {footerStats.map((s) => (
            <div key={s.label} className="bg-white px-6 py-6 text-center">
              <dt className="font-display text-3xl font-extrabold text-navy-800 sm:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink-500">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Quick links */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="group flex items-center gap-4 rounded-card border border-ink-200 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-navy-800 group-hover:text-white">
                <ArrowRightIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-display text-base font-bold text-navy-900">
                  {q.label}
                </span>
                <span className="block text-sm text-ink-500">{q.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
