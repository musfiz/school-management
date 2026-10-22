"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit as Pencil, FiPlus as Plus, FiRefreshCcw as RefreshCw, FiTrash as Trash } from "react-icons/fi";
import { RiMagicLine as Wand2 } from "react-icons/ri";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, toast } from "@/lib/swal";
import {
  GRADING_SCALE_PRESETS,
  SCALE_TYPES,
  createGradingScale,
  deleteGradingScale,
  fmt2,
  getGradingScale,
  listAttendanceSlabs,
  listGradingScales,
  updateGradingScale,
  type AttendanceSlab,
  type GradingScale,
  type GradingScaleRange,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
  BTN_DANGER,
  BTN_MODAL,
  BTN_MODAL_PRIMARY,
  BTN_PRIMARY,
  BTN_ROW,
  EmptyRow,
  Field,
  FilterCard,
  INPUT,
  KpiTile,
  Modal,
  ScopeSelect,
  TableWrap,
} from "../../_components/shared";

interface ScaleForm {
  name: string;
  scaleType: string;
  maxPoint: string;
  minPassPoint: string;
  minPassPercentage: string;
  fourthSubjectDeduction: string;
  isActive: boolean;
  ranges: GradingScaleRange[];
}

const EMPTY_RANGE: GradingScaleRange = {
  minPercentage: "0.00",
  maxPercentage: "0.00",
  letterGrade: "",
  gradePoint: "0.00",
  descriptiveRemark: "",
};

const SCALE_TYPE_OPTIONS = SCALE_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, " ") }));

/** Client-side ladder sanity (mirrors the API guard so Save fails fast). */
function ladderProblems(ranges: GradingScaleRange[]): string[] {
  const problems: string[] = [];
  if (!ranges.length) return ["At least one range is required."];
  const sorted = [...ranges].sort((a, b) => Number(a.minPercentage) - Number(b.minPercentage));
  if (Number(sorted[0].minPercentage) !== 0) problems.push("The lowest minimum must be 0.");
  for (let i = 0; i < sorted.length; i += 1) {
    const min = Number(sorted[i].minPercentage);
    const max = Number(sorted[i].maxPercentage);
    if (!Number.isFinite(min) || !Number.isFinite(max)) problems.push(`Range ${i + 1} is not numeric.`);
    else if (max <= min) problems.push(`Range ${i + 1}: maximum must exceed minimum.`);
    else if (max > 100) problems.push(`Range ${i + 1}: maximum must not exceed 100.`);
    if (i > 0 && min <= Number(sorted[i - 1].maxPercentage)) {
      problems.push(`Ranges overlap or are out of order around ${min}%.`);
    }
  }
  if (Number(sorted[sorted.length - 1].maxPercentage) < 100) problems.push("The top range must reach 100.");
  return problems;
}

export default function GradingScalesView() {
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [slabs, setSlabs] = useState<AttendanceSlab[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<GradingScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ScaleForm | null>(null);
  const [editId, setEditId] = useState("");
  const [presetId, setPresetId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, attendance] = await Promise.all([listGradingScales(), listAttendanceSlabs()]);
      setScales(list);
      setSlabs(attendance);
      setSelectedId((current) => (current && list.some((s) => s.id === current) ? current : (list[0]?.id ?? "")));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load grading scales", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void (async () => {
      setLoadingDetail(true);
      try {
        setDetail(await getGradingScale(selectedId));
      } catch (error) {
        setDetail(null);
        toast(error instanceof Error ? error.message : "Could not load the scale", "error");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedId]);

  const openCreate = (presetIndex?: number) => {
    const preset = presetIndex === undefined ? undefined : GRADING_SCALE_PRESETS[presetIndex];
    setEditId("");
    setPresetId(preset?.id ?? "");
    setForm(
      preset
        ? {
            name: preset.scale.name,
            scaleType: preset.scale.scaleType,
            maxPoint: preset.scale.maxPoint,
            minPassPoint: preset.scale.minPassPoint,
            minPassPercentage: preset.scale.minPassPercentage ?? "33.00",
            fourthSubjectDeduction: preset.scale.fourthSubjectDeduction ?? "0.00",
            isActive: true,
            ranges: preset.scale.ranges.map((range) => ({ ...range })),
          }
        : {
            name: "",
            scaleType: "GPA_5",
            maxPoint: "5.00",
            minPassPoint: "1.00",
            minPassPercentage: "33.00",
            fourthSubjectDeduction: "2.00",
            isActive: true,
            ranges: [EMPTY_RANGE],
          },
    );
  };

  const openEdit = () => {
    if (!detail) return;
    setEditId(detail.id);
    setPresetId("");
    setForm({
      name: detail.name,
      scaleType: detail.scaleType,
      maxPoint: fmt2(detail.maxPoint),
      minPassPoint: fmt2(detail.minPassPoint),
      minPassPercentage: fmt2(detail.minPassPercentage),
      fourthSubjectDeduction: fmt2(detail.fourthSubjectDeduction),
      isActive: detail.isActive,
      ranges: (detail.gradingScaleRanges ?? []).map((range) => ({
        minPercentage: fmt2(range.minPercentage),
        maxPercentage: fmt2(range.maxPercentage),
        letterGrade: range.letterGrade,
        gradePoint: fmt2(range.gradePoint),
        descriptiveRemark: range.descriptiveRemark ?? "",
      })),
    });
  };

  const problems = useMemo(() => (form ? ladderProblems(form.ranges) : []), [form]);

  const patchRange = (index: number, patch: Partial<GradingScaleRange>) => {
    setForm((current) =>
      current
        ? { ...current, ranges: current.ranges.map((range, i) => (i === index ? { ...range, ...patch } : range)) }
        : current,
    );
  };

  const save = async () => {
    if (!form) return;
    if (problems.length) {
      toast(problems[0], "error");
      return;
    }
    if (!form.name.trim()) {
      toast("A scale name is required", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        scaleType: form.scaleType,
        maxPoint: form.maxPoint,
        minPassPoint: form.minPassPoint,
        minPassPercentage: form.minPassPercentage,
        fourthSubjectDeduction: form.fourthSubjectDeduction,
        ranges: form.ranges.map((range) => ({
          minPercentage: range.minPercentage,
          maxPercentage: range.maxPercentage,
          letterGrade: range.letterGrade.trim().toUpperCase(),
          gradePoint: range.gradePoint,
          descriptiveRemark: range.descriptiveRemark?.trim() ? range.descriptiveRemark.trim() : null,
        })),
      };
      if (editId) {
        await updateGradingScale(editId, { ...payload, isActive: form.isActive });
        toast("Grading scale updated", "success");
      } else {
        const created = await createGradingScale(payload);
        toast("Grading scale created", "success");
        setSelectedId(created.id);
      }
      setForm(null);
      setEditId("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the scale", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (scale: GradingScale) => {
    const ok = await confirmDialog({
      title: `Delete "${scale.name}"?`,
      text: "Scales referenced by an exam term cannot be deleted — deactivate them instead.",
      confirmText: "Delete scale",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGradingScale(scale.id);
      toast("Grading scale deleted", "success");
      setSelectedId("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the scale", "error");
    }
  };

  const ranges = useMemo(
    () => [...(detail?.gradingScaleRanges ?? [])].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage)),
    [detail],
  );
  const scaleOptions = scales.map((scale) => ({ value: scale.id, label: `${scale.name} (${scale.scaleType})` }));

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Grading Scales & Attendance Slabs"
        description="Spec §PHASE 7 task 1 — NCTB / Madrasah / NU / Primary preset ladders plus the seeded attendance ladder (AD-4)."
      />

      <FilterCard title="Filter & presets">
        <ScopeSelect
          label="Grading scale"
          value={selectedId}
          onChange={setSelectedId}
          options={scaleOptions}
          placeholder="Select a scale"
          isClearable={false}
        />
        <ActionCell>
          {GRADING_SCALE_PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              title={preset.note}
              className={BTN}
              onClick={() => openCreate(index)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {preset.label}
            </button>
          ))}
          <button type="button" className={BTN_PRIMARY} onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            New custom scale
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Scales" value={String(scales.length)} />
        <KpiTile label="Active" value={String(scales.filter((scale) => scale.isActive).length)} tone="emerald" />
        <KpiTile label="Ranges" value={String(ranges.length)} />
        <KpiTile label="Min pass %" value={detail ? fmt2(detail.minPassPercentage) : "—"} tone="navy" />
      </div>

      {loading ? (
        <DashCard title="Scale detail">
          <AdminPageLoader variant="inline" />
        </DashCard>
      ) : !detail ? (
        <DashCard title="Scale detail">
          <p className="py-6 text-center text-xs text-ink-400">
            No grading scale selected. Pick a preset above to build one.
          </p>
        </DashCard>
      ) : (
        <DashCard
          title={detail.name}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" className={BTN_ROW} onClick={openEdit}>
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button type="button" className={`${BTN_ROW} text-rose-700`} onClick={() => void remove(detail)}>
                <Trash className="h-3 w-3" />
                Delete
              </button>
            </div>
          }
        >
          {loadingDetail ? (
            <AdminPageLoader variant="inline" />
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 2xl:grid-cols-6">
                <Field label="Type">{detail.scaleType}</Field>
                <Field label="Max point">{fmt2(detail.maxPoint)}</Field>
                <Field label="Min pass point">{fmt2(detail.minPassPoint)}</Field>
                <Field label="Min pass %">{fmt2(detail.minPassPercentage)}</Field>
                <Field label="4th-subject deduction">{fmt2(detail.fourthSubjectDeduction)}</Field>
                <Field label="Active">{detail.isActive ? "Yes" : "No"}</Field>
              </div>
              <TableWrap>
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-700">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Min %</th>
                      <th className="px-2.5 py-1.5 font-semibold">Max %</th>
                      <th className="px-2.5 py-1.5 font-semibold">Letter</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Grade point</th>
                      <th className="px-2.5 py-1.5 font-semibold">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 bg-white">
                    {ranges.length === 0 ? (
                      <EmptyRow colSpan={5} message="No ranges defined." />
                    ) : (
                      ranges.map((range) => (
                        <tr key={`${range.minPercentage}-${range.letterGrade}`} className="hover:bg-ink-50">
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(range.minPercentage)}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(range.maxPercentage)}</td>
                          <td className="px-2.5 py-1 font-semibold">{range.letterGrade}</td>
                          <td className="px-2.5 py-1 text-right font-mono">{fmt2(range.gradePoint)}</td>
                          <td className="px-2.5 py-1 text-ink-600">{range.descriptiveRemark ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </>
          )}
        </DashCard>
      )}

      <DashCard
        title="Attendance mark slabs (AD-4)"
        action={
          <button type="button" className={BTN} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      >
        <TableWrap>
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-2.5 py-1.5 font-semibold">Slab</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">From %</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">To %</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Awarded marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 bg-white">
              {slabs.length === 0 ? (
                <EmptyRow colSpan={4} message="No attendance slabs seeded." />
              ) : (
                slabs.map((slab) => (
                  <tr key={slab.id} className="hover:bg-ink-50">
                    <td className="px-2.5 py-1">{slab.name}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.minAttendancePct)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.maxAttendancePct)}</td>
                    <td className="px-2.5 py-1 text-right font-mono">{fmt2(slab.awardedMarks)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
        <p className="mt-2 text-[11px] text-ink-500">
          The ladder is seeded master data; attendance components read it through the AD-4 adapter.
        </p>
      </DashCard>

      {form && (
        <Modal
          wide
          title={editId ? "Edit grading scale" : presetId ? "Create from preset" : "New grading scale"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void save()} disabled={busy || problems.length > 0}>
                {busy ? "Saving…" : "Save scale"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={INPUT}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. NCTB Secondary GPA 5.00"
              />
            </Field>
            <ScopeSelect
              label="Scale type"
              value={form.scaleType}
              onChange={(value) => setForm({ ...form, scaleType: value })}
              options={SCALE_TYPE_OPTIONS}
              placeholder="Select type"
              isClearable={false}
            />
            <Field label="Max point">
              <input className={INPUT} value={form.maxPoint} onChange={(e) => setForm({ ...form, maxPoint: e.target.value })} />
            </Field>
            <Field label="Min pass point">
              <input className={INPUT} value={form.minPassPoint} onChange={(e) => setForm({ ...form, minPassPoint: e.target.value })} />
            </Field>
            <Field label="Min pass %">
              <input className={INPUT} value={form.minPassPercentage} onChange={(e) => setForm({ ...form, minPassPercentage: e.target.value })} />
            </Field>
            <Field label="4th-subject deduction">
              <input
                className={INPUT}
                value={form.fourthSubjectDeduction}
                onChange={(e) => setForm({ ...form, fourthSubjectDeduction: e.target.value })}
              />
            </Field>
            {editId && (
              <Field label="Active">
                <label className="flex items-center gap-2 py-1 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={form.isActive}
                    onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  />
                  Available for new exam terms
                </label>
              </Field>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-700">Range ladder</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={BTN}
                onClick={() => setForm({ ...form, ranges: GRADING_SCALE_PRESETS[0].scale.ranges.map((r) => ({ ...r })) })}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Fill NCTB ladder
              </button>
              <button type="button" className={BTN} onClick={() => setForm({ ...form, ranges: [...form.ranges, { ...EMPTY_RANGE }] })}>
                <Plus className="h-3.5 w-3.5" />
                Add range
              </button>
            </div>
          </div>

          <div className="mt-2">
            <TableWrap>
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-700">
                  <tr>
                    <th className="px-2.5 py-1.5 font-semibold">Min %</th>
                    <th className="px-2.5 py-1.5 font-semibold">Max %</th>
                    <th className="px-2.5 py-1.5 font-semibold">Letter</th>
                    <th className="px-2.5 py-1.5 font-semibold">Grade point</th>
                    <th className="px-2.5 py-1.5 font-semibold">Remark</th>
                    <th className="px-2.5 py-1.5 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {form.ranges.map((range, index) => (
                    <tr key={index}>
                      <td className="px-1.5 py-1">
                        <input className={INPUT} value={range.minPercentage} onChange={(e) => patchRange(index, { minPercentage: e.target.value })} />
                      </td>
                      <td className="px-1.5 py-1">
                        <input className={INPUT} value={range.maxPercentage} onChange={(e) => patchRange(index, { maxPercentage: e.target.value })} />
                      </td>
                      <td className="px-1.5 py-1">
                        <input className={INPUT} value={range.letterGrade} onChange={(e) => patchRange(index, { letterGrade: e.target.value })} />
                      </td>
                      <td className="px-1.5 py-1">
                        <input className={INPUT} value={range.gradePoint} onChange={(e) => patchRange(index, { gradePoint: e.target.value })} />
                      </td>
                      <td className="px-1.5 py-1">
                        <input
                          className={INPUT}
                          value={range.descriptiveRemark ?? ""}
                          onChange={(e) => patchRange(index, { descriptiveRemark: e.target.value })}
                        />
                      </td>
                      <td className="px-1.5 py-1">
                        <button
                          type="button"
                          className={`${BTN_ROW} text-rose-700`}
                          onClick={() => setForm({ ...form, ranges: form.ranges.filter((_, i) => i !== index) })}
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          {problems.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[11px] text-amber-700">
              {problems.map((problem) => (
                <li key={problem}>• {problem}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-emerald-700">Ladder covers 0–100 with no gaps or overlaps.</p>
          )}
          {presetId && (
            <p className="mt-1 text-[11px] text-ink-500">
              Preset: {GRADING_SCALE_PRESETS.find((preset) => preset.id === presetId)?.note}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
