"use client";

import { DashCard } from "@/components/dashboard/DashPage";
import SearchSelect from "@/components/ui/SearchSelect";
import type { StayExtras } from "@/lib/admissions";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const MFS_TYPES = ["BKASH", "NAGAD", "ROCKET", "BANK_EFT"].map((v) => ({
  value: v,
  label: v === "BANK_EFT" ? "Bank EFT" : v.charAt(0) + v.slice(1).toLowerCase(),
}));

interface Props {
  value: StayExtras;
  onChange: (v: StayExtras) => void;
  isMadrasah: boolean;
}

/**
 * Phase 4 — Step 4 lower half: Upobritti stipend account + hostel / bus
 * seat linkage (seat/route masters arrive later — UUIDs staged for now).
 */
export default function StayExtrasCard({ value, onChange, isMadrasah }: Props) {
  const set = (patch: Partial<StayExtras>) => onChange({ ...value, ...patch });

  return (
    <DashCard title="Stipends & Residential / Transport">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Upobritti MFS type</label>
          <SearchSelect
            options={MFS_TYPES}
            value={value.stipendMfsType}
            onChange={(v) => set({ stipendMfsType: v })}
            placeholder="None…"
            isClearable
            ariaLabel="Stipend MFS type"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Stipend account no</label>
          <input
            className={`${INPUT} font-mono`}
            placeholder="MFS / bank account…"
            value={value.stipendAccountNo}
            onChange={(e) => set({ stipendAccountNo: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">
            Hostel seat ID {isMadrasah && <span className="font-normal text-ink-500">(Lillah boarding)</span>}
          </label>
          <input
            className={`${INPUT} font-mono`}
            placeholder="UUID (seat master later)…"
            value={value.hostelSeatId}
            onChange={(e) => set({ hostelSeatId: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-ink-700">Bus route ID</label>
          <input
            className={`${INPUT} font-mono`}
            placeholder="UUID (route master later)…"
            value={value.transportRouteId}
            onChange={(e) => set({ transportRouteId: e.target.value })}
          />
        </div>
      </div>
    </DashCard>
  );
}
