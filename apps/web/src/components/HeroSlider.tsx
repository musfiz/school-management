"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { site } from "@/lib/site";

export default function HeroSlider() {
  const slides = site.heroImages;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (next: number) => setIndex((prev) => (next + slides.length) % slides.length),
    [slides.length],
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => go(index + 1), 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, go, index]);

  return (
    <section
      aria-label="School highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative h-[36vh] min-h-[260px] w-full overflow-hidden sm:h-[44vh] lg:h-[50vh]">
          {slides.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={i !== index}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-navy-900/20 to-transparent" />
            </div>
          ))}

          {/* Caption */}
          <div className="absolute inset-x-0 bottom-0 px-5 pb-12 sm:px-7">
            <p
              key={index}
              className="max-w-xl animate-fade-in-up font-display text-xl font-bold text-white drop-shadow sm:text-2xl"
            >
              {slides[index].caption}
            </p>
          </div>

          {/* Arrows */}
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm bg-white/15 p-2 text-white backdrop-blur transition-colors hover:bg-white/30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm bg-white/15 p-2 text-white backdrop-blur transition-colors hover:bg-white/30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-sm transition-all ${
                  i === index ? "w-6 bg-gold-400" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
