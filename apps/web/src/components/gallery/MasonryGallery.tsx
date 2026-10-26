"use client";

import { useState } from "react";
import Image from "next/image";
import { MasonryPhotoAlbum, type RenderImageContext, type RenderImageProps } from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "react-photo-album/masonry.css";
import "yet-another-react-lightbox/styles.css";
import { isExternalImage } from "@/lib/media";

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  category?: string;
  width: number;
  height: number;
}

/**
 * Clean mock data showcasing different aspect ratios:
 * - Landscape (16:10, 3:2)
 * - Portrait (2:3, 3:4)
 * - Square (1:1)
 *
 * Configured with images from Unsplash (domain allowed in next.config.ts).
 */
export const MOCK_GALLERY_IMAGES: GalleryItem[] = [
  {
    id: "g-1",
    src: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=1200&q=80",
    alt: "Annual Sports and Athletics Day",
    title: "Annual Sports Day",
    category: "Sports",
    width: 1200,
    height: 800, // Landscape (3:2)
  },
  {
    id: "g-2",
    src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
    alt: "Classroom collaboration and learning",
    title: "Classroom Innovation",
    category: "Academic",
    width: 800,
    height: 1200, // Portrait (2:3)
  },
  {
    id: "g-3",
    src: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=900&q=80",
    alt: "Student performing physics experiments in modern laboratory",
    title: "Science & Robotics Lab",
    category: "Laboratories",
    width: 900,
    height: 900, // Square (1:1)
  },
  {
    id: "g-4",
    src: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80",
    alt: "Graduation and award ceremony celebration",
    title: "Graduation Ceremony",
    category: "Ceremony",
    width: 1200,
    height: 750, // Landscape (16:10)
  },
  {
    id: "g-5",
    src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80",
    alt: "Central library quiet study area",
    title: "Central Library Hall",
    category: "Campus",
    width: 800,
    height: 1150, // Tall Portrait
  },
  {
    id: "g-6",
    src: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=80",
    alt: "Students presenting art project during cultural week",
    title: "Cultural Art Festival",
    category: "Arts & Culture",
    width: 1000,
    height: 667, // Landscape (3:2)
  },
];

interface MasonryGalleryProps {
  /** Optional custom image list; defaults to MOCK_GALLERY_IMAGES */
  images?: GalleryItem[];
}

/**
 * Custom image renderer that swaps react-photo-album's plain <img> for the
 * Next.js <Image> component (official "Next.js Image" integration pattern).
 *
 * The wrapping div carries the photo's aspect ratio and relative positioning,
 * so the fill-sized <Image> always keeps the exact proportions computed by the
 * masonry layout algorithm while still getting Next.js optimization.
 */
function renderNextImage(
  { alt = "", title, sizes }: RenderImageProps,
  { photo, width, height, index }: RenderImageContext,
) {
  return (
    <div
      style={{
        width: "100%",
        position: "relative",
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <Image
        fill
        src={photo.src}
        alt={alt}
        title={title}
        sizes={sizes}
        priority={index < 4}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        unoptimized={isExternalImage(photo.src)}
      />
    </div>
  );
}

/**
 * Responsive Masonry Image Gallery built on react-photo-album (handles aspect
 * ratios and column counts dynamically across breakpoints) with a
 * yet-another-react-lightbox full-screen viewer (Prev/Next, close, zoom &
 * fullscreen, built-in open/close transitions).
 */
export default function MasonryGallery({
  images = MOCK_GALLERY_IMAGES,
}: MasonryGalleryProps) {
  const [photoIndex, setPhotoIndex] = useState<number>(-1);

  // Slides expected by yet-another-react-lightbox (src + intrinsic dimensions).
  const slides = images.map((image) => ({
    src: image.src,
    alt: image.alt,
    title: image.title,
    width: image.width,
    height: image.height,
  }));

  return (
    <div className="w-full">
      <MasonryPhotoAlbum
        photos={images}
        // Every photo renders as an accessible <button>; clicking opens the lightbox.
        onClick={({ index }) => setPhotoIndex(index)}
        render={{ image: renderNextImage }}
        // Tailwind-only hover affordance; the album handles layout, we handle style.
        componentsProps={{ button: { className: "group" } }}
        spacing={16}
        columns={(containerWidth) => {
          if (containerWidth < 400) return 2;
          if (containerWidth < 900) return 3;
          return 4;
        }}
        // Recalculate layout only when the container crosses a breakpoint.
        breakpoints={[400, 900, 1200]}
        // SSR fallback width (content column) so the grid isn't empty pre-hydration.
        defaultContainerWidth={1000}
        sizes={{
          size: "1000px",
          sizes: [{ viewport: "(max-width: 1280px)", size: "calc(100vw - 64px)" }],
        }}
      />

      {/* Fullscreen Lightbox Modal — Prev/Next, close, zoom & fullscreen */}
      <Lightbox
        open={photoIndex >= 0}
        index={photoIndex}
        close={() => setPhotoIndex(-1)}
        slides={slides}
        plugins={[Fullscreen, Zoom]}
      />
    </div>
  );
}
