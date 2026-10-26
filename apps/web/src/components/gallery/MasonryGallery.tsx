"use client";

import { useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

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
 * Responsive Masonry Image Gallery with Next.js Image Optimization
 * and Yet-Another-React-Lightbox full-screen preview.
 */
export default function MasonryGallery({
  images = MOCK_GALLERY_IMAGES,
}: MasonryGalleryProps) {
  const [photoIndex, setPhotoIndex] = useState<number>(-1);

  // Prepare slides configuration expected by yet-another-react-lightbox
  const slides = images.map((image) => ({
    src: image.src,
    alt: image.alt,
    title: image.title,
    width: image.width,
    height: image.height,
  }));

  return (
    <div className="w-full">
      {/*
        Masonry Grid Layout using CSS column multi-column layout.
        Break-inside-avoid prevents cards from breaking across column lines.
      */}
      <div className="columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4">
        {images.map((img, idx) => (
          <div
            key={img.id}
            onClick={() => setPhotoIndex(idx)}
            className="group relative mb-4 break-inside-avoid cursor-pointer overflow-hidden rounded-xs border border-ink-200 bg-white shadow-soft transition-all duration-300 hover:border-brand-400 hover:shadow-card"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setPhotoIndex(idx);
              }
            }}
            aria-label={`View ${img.title} full screen`}
          >
            {/* Preserves original aspect ratio without cropping */}
            <div className="relative overflow-hidden bg-ink-100">
              <Image
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="h-auto w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                priority={idx < 4}
              />
            </div>

            {/*
              TODO: Future feature - image title, description and category tag
              <div className="flex items-center justify-between border-t border-ink-100 bg-white p-3">
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-navy-900 group-hover:text-brand-600 transition-colors">
                    {img.title}
                  </p>
                  <p className="truncate text-[11px] text-ink-500">{img.alt}</p>
                </div>
                {img.category && (
                  <span className="shrink-0 rounded-xs bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">
                    {img.category}
                  </span>
                )}
              </div>
            */}

            {/* Subtle overlay affordance on hover */}
            <div className="pointer-events-none absolute inset-0 bg-navy-950/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
        ))}
      </div>

      {/* Fullscreen Lightbox Modal */}
      <Lightbox
        open={photoIndex >= 0}
        index={photoIndex}
        close={() => setPhotoIndex(-1)}
        slides={slides}
      />
    </div>
  );
}
