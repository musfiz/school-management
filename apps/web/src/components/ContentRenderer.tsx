import type { Block } from "@/lib/content/types";
import { ArrowRightIcon } from "./icons";

function Callout({ tone, title, text }: Extract<Block, { type: "callout" }>) {
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    gold: "border-gold-200 bg-gold-100 text-navy-900",
  } as const;
  return (
    <div className={`rounded-card border p-5 ${tones[tone]}`}>
      <p className="font-display text-base font-bold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed opacity-90">{text}</p>
    </div>
  );
}

export default function ContentRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-8">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "prose":
            return (
              <p key={i} className="max-w-3xl text-lg leading-relaxed text-ink-700">
                {block.text}
              </p>
            );
          case "heading":
            return block.level === 2 ? (
              <h2
                key={i}
                className="mt-4 font-display text-2xl font-bold text-navy-900 sm:text-3xl"
              >
                {block.text}
              </h2>
            ) : (
              <h3 key={i} className="font-display text-xl font-bold text-navy-800">
                {block.text}
              </h3>
            );
          case "list":
            return block.ordered ? (
              <ol
                key={i}
                className="list-decimal space-y-2 pl-6 text-ink-700 marker:font-semibold"
              >
                {block.items.map((it, j) => (
                  <li key={j} className="pl-1 leading-relaxed">
                    {it}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-2 pl-6 text-ink-700 marker:text-gold-500">
                {block.items.map((it, j) => (
                  <li key={j} className="pl-1 leading-relaxed">
                    {it}
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return <Callout key={i} {...block} />;
          case "stats":
            return (
              <dl
                key={i}
                className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-ink-200 bg-ink-200 shadow-soft sm:grid-cols-4"
              >
                {block.items.map((s) => (
                  <div key={s.label} className="bg-white px-5 py-6 text-center">
                    <dt className="font-display text-3xl font-extrabold text-navy-800">
                      {s.value}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-ink-500">
                      {s.label}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          case "cards":
            return (
              <div key={i} className="grid gap-5 sm:grid-cols-2">
                {block.items.map((c) => (
                  <div
                    key={c.title}
                    className="rounded-card border border-ink-200 bg-white p-6 shadow-soft"
                  >
                    {c.meta && (
                      <p className="text-xs font-bold uppercase tracking-wider text-gold-600">
                        {c.meta}
                      </p>
                    )}
                    <h3 className="mt-1 font-display text-lg font-bold text-navy-900">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="rounded-card border-l-4 border-gold-400 bg-navy-50 p-6"
              >
                <p className="font-display text-xl font-medium italic text-navy-900">
                  “{block.text}”
                </p>
                {block.cite && (
                  <footer className="mt-2 text-sm font-semibold text-ink-500">
                    {block.cite}
                  </footer>
                )}
              </blockquote>
            );
          case "gallery":
            return (
              <div key={i} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {block.images.map((img, j) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={j}
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-card object-cover shadow-soft"
                  />
                ))}
              </div>
            );
          case "cta":
            return (
              <div
                key={i}
                className="flex flex-col items-start gap-4 rounded-card bg-navy-800 p-8 text-white sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-display text-xl font-bold">{block.title}</h3>
                  <p className="mt-1 text-sm text-navy-100">{block.text}</p>
                </div>
                <a
                  href={block.href}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-400"
                >
                  {block.hrefLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
