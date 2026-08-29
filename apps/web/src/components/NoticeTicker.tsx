import Link from "next/link";
import { notices } from "@/lib/content/collections";

/** Auto-scrolling notice ticker shown under the header. */
export default function NoticeTicker() {
  const items = notices;
  if (items.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly (-50% translate).
  const loop = [...items, ...items];

  return (
    <div className="border-b border-gold-200 bg-gold-100">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6">
        <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-navy-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-300">
          Notice
        </span>
        <div className="group relative overflow-hidden py-2">
          <div className="flex w-max gap-10 marquee-track group-hover:[animation-play-state:paused]">
            {loop.map((n, i) => (
              <Link
                key={`${n.id}-${i}`}
                href="/others/notice"
                className="flex shrink-0 items-center gap-2 text-sm text-navy-900 hover:text-navy-700"
              >
                <span className="h-1.5 w-1.5 rounded-sm bg-gold-500" aria-hidden />
                <span className="font-medium">{n.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
