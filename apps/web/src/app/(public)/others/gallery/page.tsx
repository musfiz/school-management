import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Breadcrumbs, PageHeader, Section } from "@/components/ui";
import MasonryGallery, { type GalleryItem } from "@/components/gallery/MasonryGallery";
import { resolveImageUrl } from "@/lib/media";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photo gallery of campus life, academic milestones and events at Model High School.",
};

interface ApiGalleryRecord {
  id: string;
  imageUrl: string;
  titleEn?: string | null;
  titleBn?: string | null;
  subtitleEn?: string | null;
  subtitleBn?: string | null;
  tagEn?: string | null;
  tagBn?: string | null;
  sortOrder: number;
  isActive: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3031";

async function getPublishedGalleries(): Promise<ApiGalleryRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/galleries`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const locale = await getLocale();
  const apiItems = await getPublishedGalleries();

  const dynamicImages: GalleryItem[] | undefined =
    apiItems.length > 0
      ? apiItems.map((item) => {
          const title = (locale === "bn" && item.titleBn) || item.titleEn || "";
          const subtitle = (locale === "bn" && item.subtitleBn) || item.subtitleEn || "";
          const tag = (locale === "bn" && item.tagBn) || item.tagEn || undefined;
          return {
            id: item.id,
            src: resolveImageUrl(item.imageUrl),
            alt: title || subtitle || "Campus Gallery Photo",
            title,
            category: tag,
            width: 1200,
            height: 800,
          };
        })
      : undefined;

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
        <MasonryGallery images={dynamicImages} />
      </Section>
    </>
  );
}
