import type { Metadata } from "next";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import MasonryGallery from "@/components/gallery/MasonryGallery";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo gallery of campus life, academic milestones and events at Model High School.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader eyebrow="Others" title="Gallery" className="py-6 sm:py-8" />
      <Breadcrumbs
        className="py-1.5"
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Gallery", href: "/others/gallery" },
        ]}
      />
      <Section className="py-6! sm:py-8!">
        <MasonryGallery />
      </Section>
    </>
  );
}
