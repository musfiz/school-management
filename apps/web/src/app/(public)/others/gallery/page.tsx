import type { Metadata } from "next";
import Image from "next/image";
import { gallery } from "@/lib/content/collections";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo gallery of campus life at Model High School.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Others"
        title="Gallery"
        description="Moments from classrooms, labs, sports and events."
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Others", href: "/others" },
          { name: "Gallery", href: "/others/gallery" },
        ]}
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((img) => (
            <figure
              key={img.id}
              className="group overflow-hidden rounded-card border border-ink-200 bg-white shadow-soft"
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={800}
                height={600}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <figcaption className="flex items-center justify-between p-4">
                <span className="font-display font-semibold text-navy-900">
                  {img.title}
                </span>
                <span className="text-xs text-ink-400">{img.category}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </>
  );
}
