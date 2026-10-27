import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import RoutineListView, { type RoutineItem } from "./RoutineListView";

export const metadata: Metadata = {
  title: "Routine",
  description: "Class and examination routines for Model High School.",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function getPublishedRoutines(): Promise<RoutineItem[]> {
  try {
    const res = await fetch(`${API_BASE}/routines`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function RoutinePage() {
  const locale = await getLocale();
  const routines = await getPublishedRoutines();

  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Class & Exam Routines"
        description="View and download class and examination schedules session and class-wise."
        className="py-6 sm:py-8"
      />
      <Breadcrumbs
        className="py-1.5"
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Routine", href: "/others/routine" },
        ]}
      />
      <Section className="py-6! sm:py-8!">
        <RoutineListView initialRoutines={routines} locale={locale} />
      </Section>
    </>
  );
}
