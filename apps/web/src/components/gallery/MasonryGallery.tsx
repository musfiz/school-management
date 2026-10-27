"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  category?: string;
  width?: number;
  height?: number;
}

/**
 * Clean mock data showcasing different natural aspect ratios:
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
 * Responsive Masonry Image Gallery built on native CSS multi-column layout
 * (preserves 100% natural aspect ratios without forced 16:9 / 3:2 cropping)
 * with a yet-another-react-lightbox full-screen viewer (Prev/Next, zoom &
 * fullscreen).
 */
export default function MasonryGallery({
  images = MOCK_GALLERY_IMAGES,
}: MasonryGalleryProps) {
  const [photoIndex, setPhotoIndex] = useState<number>(-1);

  // Slides expected by yet-another-react-lightbox (src + intrinsic dimensions if available).
  const slides = images.map((image) => ({
    src: image.src,
    alt: image.alt,
    title: image.title,
    width: image.width,
    height: image.height,
  }));

  return (
    <div className="w-full">
      <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4 [column-fill:_balance]">
        {images.map((image, index) => (
          <figure
            key={image.id || index}
            onClick={() => setPhotoIndex(index)}
            className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-xs border border-ink-200 bg-white shadow-soft transition-all duration-300 hover:border-brand-300 hover:shadow-card"
          >
            <div className="relative overflow-hidden bg-ink-100">
              <img
                src={image.src}
                alt={image.alt}
                loading={index < 4 ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-navy-950/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            {(image.title || image.category) && (
              <figcaption className="p-3">
                {image.title && (
                  <h3 className="font-display text-sm font-semibold text-navy-900 transition-colors group-hover:text-brand-600">
                    {image.title}
                  </h3>
                )}
                {image.category && (
                  <span className="mt-1 inline-block rounded-xs bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
                    {image.category}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

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
