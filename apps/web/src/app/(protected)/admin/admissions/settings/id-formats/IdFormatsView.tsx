"use client";

import { useState, useEffect, useCallback } from "react";
import { DashPageHeader } from "@/components/dashboard/DashPage";
import { DashCard } from "@/components/dashboard/DashPage";
import { FiCheckCircle, FiLoader } from "react-icons/fi";
import SearchSelect from "@/components/ui/SearchSelect";
import { apiFetch } from "@/lib/api";
import { listClassOrDepts } from "@/lib/academic-results";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { toast } from "@/lib/swal";
import { useId } from "react";

const INPUT =
  "w-full rounded-xs cursor-pointer border border-ink-200 bg-white px-2.5 py-1 text-sm outline-none transition-colors focus:border-brand-400";

const BTN = "rounded-xs border border-brand-600 bg-brand-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50";
const BTN_GHOST =
  "rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50";

interface IdFormatConfig {
  prefix: string;
  yearBase: string;
  classCode: string | null;
  seqWidth: number;
}

interface GeneratedId {
  format: string;
  studentId: string;
  display: string;
}

function IdFormatsView() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<IdFormatConfig>({
    prefix: "STD",
    yearBase: new Date().getFullYear().toString().slice(2),
    classCode: null,
    seqWidth: 4,
  });
  const [generated, setGenerated] = useState<GeneratedId[]>([]);
  const [previewSeq, setPreviewSeq] = useState(0);
  const [schoolYear, setSchoolYear] = useState<string>(new Date().getFullYear().toString());
  const [showLoader, setShowLoader] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);

  // Load available class codes from the backend
  useEffect(() => {
    setLoading(true);
    listClassOrDepts().then(
      (res) => {
        setClasses(res.map((c) => c.code));
        setPreviewSeq(Math.max(0, res.length - 1));
        handleGenerate();
      }
    ).finally(() => setLoading(false));
  }, []);

  const handleGenerate = useCallback(() => {
    const { prefix, yearBase, classCode, seqWidth } = config;
    const seqStart = previewSeq;
    const results: GeneratedId[] = [];

    for (let i = 0; i < 5; i++) {
      const seq = seqStart + i;
      let base = `${prefix}-${yearBase}`;
      if (classCode) {
        base = `${prefix}-${classCode}-${yearBase}`;
      }
      const seqStr = String(seq).padStart(seqWidth, "0");
      const studentId = classCode ? `${base}-${seqStr}` : `${base}-${seqStr}`;
      results.push({
        format: classCode ? `${prefix}-${classCode}-${yearBase}-SEQ${seqStr}` : `${prefix}-${yearBase}-SEQ${seqStr}`,
        studentId,
        display: studentId,
      });
    }
    setGenerated(results);
  }, [config]);

  const onChangePrefix = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((c) => ({ ...c, prefix: e.target.value }));
    handleGenerate();
  };

  const onChangeYearBase = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((c) => ({ ...c, yearBase: e.target.value.slice(2) }));
    handleGenerate();
  };

  const onChangeSeqWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((c) => ({ ...c, seqWidth: Number(e.target.value) }));
    handleGenerate();
  };

  const onChangeClassCode = (v: string) => {
    setConfig((c) => ({ ...c, classCode: v || null }));
    handleGenerate();
  };

  const onChangePreviewSeq = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewSeq(Number(e.target.value));
    handleGenerate();
  };

  const onSubmit = useCallback(async () => {
    setShowLoader(true);
    try {
      await apiFetch("/api/admissions/id-formats", {
        method: "POST",
        body: JSON.stringify({ config }),
      });
      toast({
        title: "ID format saved",
        text: "The ID format configuration has been saved.",
        icon: "success",
      });
    } catch (e: any) {
      toast({
        title: "Save failed",
        text: e?.message ?? "Unknown error",
        icon: "error",
      });
    } finally {
      setShowLoader(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="ID & Roll Formats"
        description="Plan Phase 1 — student ID + class roll sequence builder with row-lock safety"
      />

      {/* Config card using DashCard */}
      <DashCard title="Student ID Format Builder">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Prefix
            </label>
            <input
              value={config.prefix}
              onChange={onChangePrefix}
              placeholder="STD"
              className={INPUT}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Year base (last 2 digits)
            </label>
            <input
              type="number"
              value={config.yearBase}
              onChange={onChangeYearBase}
              min={20}
              max={99}
              placeholder="26"
              className={INPUT}
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Class code (optional)
            </label>
            <SearchSelect
              isDisabled={loading}
              placeholder="Select class / dept"
              value={config.classCode ?? ""}
              options={classes.map((c) => ({ value: c, label: c }))}
              onChange={onChangeClassCode}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Sequence width
            </label>
            <input
              type="number"
              value={config.seqWidth}
              onChange={onChangeSeqWidth}
              min={3}
              max={8}
              placeholder="4"
              className={INPUT}
            />
            <span className="ml-2 text-xs text-ink-500">digits</span>
          </div>
        </form>
      </DashCard>

      {/* Preview card */}
      <DashCard title="Generated ID Preview">
        {loading && classes.length === 0 ? (
          <AdminPageLoader variant="inline" />
        ) : generated.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {generated.map((g, i) => (
              <div key={i} className="rounded-xs border border-ink-100 p-3 text-center">
                <p className="text-xs font-medium text-ink-500">{g.format}</p>
                <p className="font-mono text-lg font-bold text-ink-900">{g.display}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-ink-400">
            Configure the format above to preview IDs.
          </p>
        )}
      </DashCard>

      {/* Roll sequence info card */}
      <DashCard title="Roll Sequence Reference">
        <p className="text-sm text-ink-500">
          The {config.classCode ? `class‑code “${config.classCode}” ` : ""}roll sequence uses
          row‑level locking (SELECT … FOR UPDATE) under scope
          <code>ROLL:{schoolYear}:{config.classCode ?? "ALL"}:{classes[0] || "NOSEC"}</code>.
          Concurrent admitters into the same section serialize on this scope and never
          share a <code>class_roll_no</code>. The UNIQUE guard
          <code>uq_session_class_section_roll</code> is the backstop.
        </p>
        <div className="mt-3">
          <label className="block text-xs font-medium text-ink-700">Preview roll sequence</label>
          <input
            value={previewSeq}
            onChange={onChangePreviewSeq}
            min={0}
            placeholder="0"
            className={INPUT}
          />
          <span className="ml-2 text-xs text-ink-500">→ roll #{previewSeq + 1}</span>
        </div>
      </DashCard>

      {/* Save button */}
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN} disabled={loading} onClick={onSubmit}>
          {showLoader ? (
            <span className="inline-flex items-center gap-1"><FiLoader className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
          ) : (
            <span>Save ID Format</span>
          )}
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => {
          setConfig({ prefix: "STD", yearBase: new Date().getFullYear().toString().slice(2), classCode: null, seqWidth: 4 });
          handleGenerate();
        }}>
          Reset
        </button>
      </div>
    </div>
  );
}

export default IdFormatsView;