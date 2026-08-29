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
      <PageHeader
        eyebrow="Result"
        title="Exam Result"
        description="Enter your class and roll number to view your published result."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Result", href: "/result" },
          { name: "Exam Result", href: "/result/exam-result" },
        ]}
      />
      <Section>
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
