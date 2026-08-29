import type { Metadata } from "next";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Routine",
  description: "Class and examination routines for Model High School.",
};

const weekly = [
  { period: "1st (9:30–10:10)", subject: "English", class: "Class VII" },
  { period: "2nd (10:10–10:50)", subject: "Mathematics", class: "Class VII" },
  { period: "3rd (11:10–11:50)", subject: "Bangla", class: "Class VII" },
  { period: "4th (11:50–12:30)", subject: "Science", class: "Class VII" },
  { period: "5th (12:50–1:30)", subject: "Social Science", class: "Class VII" },
];

export default function RoutinePage() {
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Routine"
        description="Daily class routine and examination schedules."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Routine", href: "/others/routine" },
        ]}
      />
      <Section>
        <div className="overflow-hidden rounded-sm border border-ink-200 bg-white shadow-soft">
          <div className="border-b border-ink-200 bg-navy-50 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-navy-900">
              Sample Daily Class Routine — Class VII
            </h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Period</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold">Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {weekly.map((r) => (
                <tr key={r.period}>
                  <td className="px-6 py-3 text-ink-700">{r.period}</td>
                  <td className="px-6 py-3 font-medium text-navy-800">{r.subject}</td>
                  <td className="px-6 py-3 text-ink-500">{r.class}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-ink-500">
          Full examination routines are published on the{" "}
          <a href="/others/notice" className="font-semibold text-navy-700 hover:underline">
            Notice Board
          </a>{" "}
          and in the{" "}
          <a href="/others/download" className="font-semibold text-navy-700 hover:underline">
            Download
          </a>{" "}
          section.
        </p>
      </Section>
    </>
  );
}
