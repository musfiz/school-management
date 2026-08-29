import type { Metadata } from "next";
import { teachers } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Teachers",
  description: "Meet the current and former faculty of Model High School.",
};

export default function TeachersPage() {
  const current = teachers.filter((t) => t.status === "current");
  const former = teachers.filter((t) => t.status === "former");

  return (
    <>
      <PageHeader
        eyebrow="Academic"
        title="Our Teachers"
        description="Dedicated educators who make learning come alive."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Academic", href: "/academic" },
          { name: "Teachers", href: "/academic/teachers" },
        ]}
      />

      <Section>
        <h2 className="font-display text-xl font-bold text-navy-900">Current Faculty</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((t) => (
            <div
              key={t.id}
              className="rounded-card border border-ink-200 bg-white p-6 shadow-soft"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 font-display text-lg font-bold text-navy-800">
                  {t.name.split(" ").slice(-1)[0].charAt(0)}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-navy-900">{t.name}</h3>
                  <p className="text-sm text-brand-600">{t.designation}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-500">{t.department}</p>
              {t.education && (
                <p className="mt-2 text-sm text-ink-600">{t.education}</p>
              )}
            </div>
          ))}
        </div>

        {former.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-xl font-bold text-navy-900">
              Former Faculty
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {former.map((t) => (
                <li
                  key={t.id}
                  className="rounded-card border border-ink-200 bg-ink-50 px-5 py-4"
                >
                  <p className="font-semibold text-navy-900">{t.name}</p>
                  <p className="text-sm text-ink-500">{t.designation}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  );
}
