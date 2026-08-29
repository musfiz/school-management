import type { Metadata } from "next";
import { staff } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Staffs",
  description: "Administrative and support staff of Model High School.",
};

export default function StaffsPage() {
  const current = staff.filter((s) => s.status === "current");
  const former = staff.filter((s) => s.status === "former");

  return (
    <>
      <PageHeader
        eyebrow="Academic"
        title="Our Staff"
        description="The team that keeps the school running smoothly."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Academic", href: "/academic" },
          { name: "Staffs", href: "/academic/staffs" },
        ]}
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((s) => (
            <div
              key={s.id}
              className="rounded-card border border-ink-200 bg-white p-5 shadow-soft"
            >
              <h3 className="font-display font-bold text-navy-900">{s.name}</h3>
              <p className="text-sm text-brand-600">{s.role}</p>
              <p className="mt-1 text-xs text-ink-400">{s.department}</p>
            </div>
          ))}
        </div>
        {former.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-navy-900">Former Staff</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {former.map((s) => (
                <li
                  key={s.id}
                  className="rounded-card border border-ink-200 bg-ink-50 px-5 py-4"
                >
                  <p className="font-semibold text-navy-900">{s.name}</p>
                  <p className="text-sm text-ink-500">{s.role}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
