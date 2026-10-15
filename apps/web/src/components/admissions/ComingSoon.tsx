"use client";

import { DashCard } from "@/components/dashboard/DashPage";

interface Props {
  /** Plan reference, e.g. "Plan §3.1". */
  spec: string;
  /** What ships here and when, e.g. "Workflow 2 · live in Step 4". */
  status: string;
  bullets: string[];
}

/** Staged placeholder so every sidebar leaf resolves to a same-titled page. */
export default function ComingSoon({ spec, status, bullets }: Props) {
  return (
    <DashCard title={`Coming up — ${spec}`}>
      <p className="mb-2 inline-block rounded-xs bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
        {status}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </DashCard>
  );
}
