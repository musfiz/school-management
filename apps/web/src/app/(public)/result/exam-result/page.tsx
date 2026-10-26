import type { Metadata } from "next";
import ResultLookup from "@/components/ResultLookup";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { Breadcrumbs, Container, JsonLd, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Exam Result",
  description: "Look up your examination result by class and roll number.",
};

export default function ExamResultPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", href: "/" },
          { name: "Result", href: "/result" },
          { name: "Exam Result", href: "/result/exam-result" },
        ])}
      />
      <PageHeader eyebrow="Result" title="Exam Result" className="py-6 sm:py-8" />
      <Breadcrumbs
        className="py-1.5"
        items={[
          { name: "Home", href: "/" },
          { name: "Result", href: "/result" },
          { name: "Exam Result", href: "/result/exam-result" },
        ]}
      />
      <Section className="py-6! sm:py-8!">
        <ResultLookup />
        <p className="mt-6 text-sm text-ink-500">
          For public board examinations, please use the{" "}
          <a href="/result/board-exam-result" className="font-semibold text-navy-700 hover:underline">
            Board Exam Result
          </a>{" "}
          page. Results are published as approved by the examination committee.
        </p>
      </Section>
    </>
  );
}
