"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Scale, Sliders, Trash2, Pencil } from "lucide-react";
import { DashCard, DashPageHeader } from "@/components/dashboard/DashPage";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";
import { confirmDialog, promptDialog, toast } from "@/lib/swal";
import {
  CT_AGGREGATION_MODES,
  MARK_ROUNDING_MODES,
  TERM_STATUSES,
  TERM_TYPES,
  createTerm,
  deleteTerm,
  fmt2,
  getTermWeights,
  isControllerOnlyTransition,
  listGradingScales,
  listTerms,
  nextStatuses,
  setTermStatus,
  setTermWeights,
  updateTerm,
  type ExamTerm,
  type GradingScale,
} from "@/lib/academic-results";
import {
  ActionCell,
  BTN,
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
  StatusBadge,
  TableWrap,
  useScopeOptions,
} from "../_components/shared";

interface TermForm {
  id: string;
  termName: string;
  termType: string;
  gradingScaleId: string;
  parentTerminalExamId: string;
  sequenceNo: string;
  ctAggregationMode: string;
  ctBestCount: string;
  annualWeightPct: string;
  markRoundingMode: string;
  minCoursesToPromote: string;
  minCgpaToPromote: string;
}

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value.replace(/_/g, " ") }));

const emptyForm = (): TermForm => ({
  id: "",
  termName: "",
  termType: "TERMINAL",
  gradingScaleId: "",
  parentTerminalExamId: "",
  sequenceNo: "1",
  ctAggregationMode: "BEST_N_AVERAGE",
  ctBestCount: "2",
  annualWeightPct: "100.00",
  markRoundingMode: "HALF_UP_INTEGER",
  minCoursesToPromote: "0",
  minCgpaToPromote: "0.00",
});

export default function ExamsView() {
  const { sessionId, setSessionId, classId, setClassId, sessions, classes } = useCascadingScope();
  const [termType, setTermType] = useState("");
  const [status, setStatus] = useState("");

  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<TermForm | null>(null);
  const [weightsFor, setWeightsFor] = useState<ExamTerm | null>(null);
  const [weights, setWeights] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!sessionId || !classId) {
      setTerms([]);
      return;
    }
    setLoading(true);
    try {
      setTerms(await listTerms({ academicSessionId: sessionId, classOrDeptId: classId, termType, status }));
    } catch (error) {
      setTerms([]);
      toast(error instanceof Error ? error.message : "Could not load exam terms", "error");
    } finally {
      setLoading(false);
    }
  }, [sessionId, classId, termType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        setScales(await listGradingScales());
      } catch {
        setScales([]);
      }
    })();
  }, []);

  const scaleName = useCallback(
    (id: string) => scales.find((scale) => scale.id === id)?.name ?? id.slice(0, 8),
    [scales],
  );
  const scaleOptions = scales.map((scale) => ({ value: scale.id, label: `${scale.name} (${scale.scaleType})` }));
  const terminalOptions = terms
    .filter((term) => term.termType === "TERMINAL")
    .map((term) => ({ value: term.id, label: `${term.termName} · ${term.status}` }));

  const openCreate = () => setForm({ ...emptyForm(), gradingScaleId: scales[0]?.id ?? "", termType: "TERMINAL" });
  const openEdit = (term: ExamTerm) =>
    setForm({
      id: term.id,
      termName: term.termName,
      termType: term.termType,
      gradingScaleId: term.gradingScaleId,
      parentTerminalExamId: term.parentTerminalExamId ?? "",
      sequenceNo: String(term.sequenceNo),
      ctAggregationMode: term.ctAggregationMode,
      ctBestCount: String(term.ctBestCount),
      annualWeightPct: fmt2(term.annualWeightPct),
      markRoundingMode: term.markRoundingMode,
      minCoursesToPromote: String(term.minCoursesToPromote),
      minCgpaToPromote: fmt2(term.minCgpaToPromote),
    });

  const saveTerm = async () => {
    if (!form || !sessionId || !classId) return;
    if (!form.termName.trim()) {
      toast("A term name is required", "error");
      return;
    }
    if (!form.gradingScaleId) {
      toast("Pick a grading scale", "error");
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await updateTerm(form.id, {
          gradingScaleId: form.gradingScaleId,
          termName: form.termName.trim(),
          parentTerminalExamId: form.parentTerminalExamId || null,
          sequenceNo: Number(form.sequenceNo) || 1,
          ctAggregationMode: form.ctAggregationMode,
          ctBestCount: Number(form.ctBestCount) || 1,
          annualWeightPct: form.annualWeightPct,
          markRoundingMode: form.markRoundingMode,
          minCoursesToPromote: Number(form.minCoursesToPromote) || 0,
          minCgpaToPromote: form.minCgpaToPromote,
        });
        toast("Exam term updated", "success");
      } else {
        await createTerm({
          academicSessionId: sessionId,
          classOrDeptId: classId,
          gradingScaleId: form.gradingScaleId,
          termName: form.termName.trim(),
          termType: form.termType,
          parentTerminalExamId: form.parentTerminalExamId || null,
          sequenceNo: Number(form.sequenceNo) || 1,
          ctAggregationMode: form.ctAggregationMode,
          ctBestCount: Number(form.ctBestCount) || 1,
          annualWeightPct: form.annualWeightPct,
          markRoundingMode: form.markRoundingMode,
          minCoursesToPromote: Number(form.minCoursesToPromote) || 0,
          minCgpaToPromote: form.minCgpaToPromote,
        });
        toast("Exam term created", "success");
      }
      setForm(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the term", "error");
    } finally {
      setBusy(false);
    }
  };

  const transition = async (term: ExamTerm, target: string) => {
    const controllerOnly = isControllerOnlyTransition(term.status, target);
    let reason: string | undefined;
    if (controllerOnly) {
      const entered = await promptDialog({
        title: `Reopen "${term.termName}"?`,
        text: "Reopening a published term is controller-only and is written to the accounting audit log.",
        input: "textarea",
        required: true,
        confirmText: "Reopen term",
      });
      if (!entered) return;
      reason = entered;
    } else {
      const ok = await confirmDialog({
        title: `Move "${term.termName}" to ${target}?`,
        text: `CC-18 transition ${term.status} → ${target}.`,
        confirmText: `Set ${target}`,
      });
      if (!ok) return;
    }
    try {
      await setTermStatus(term.id, target, reason);
      toast(`Term is now ${target}`, "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Status change rejected", "error");
    }
  };

  const removeTerm = async (term: ExamTerm) => {
    const ok = await confirmDialog({
      title: `Delete "${term.termName}"?`,
      text: "Only a term still in SETUP can be deleted.",
      confirmText: "Delete term",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTerm(term.id);
      toast("Exam term deleted", "success");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the term", "error");
    }
  };

  const openWeights = async (term: ExamTerm) => {
    setWeightsFor(term);
    setWeights({});
    try {
      const current = await getTermWeights(term.id);
      const map: Record<string, string> = {};
      for (const weight of current.weights) map[weight.childExamTermId] = fmt2(weight.weightPct);
      setWeights(map);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not load weights", "error");
    }
  };

  const saveWeights = async () => {
    if (!weightsFor) return;
    const payload = Object.entries(weights)
      .filter(([, value]) => value.trim() !== "")
      .map(([childExamTermId, weightPct]) => ({ childExamTermId, weightPct }));
    if (!payload.length) {
      toast("Enter at least one child weight", "error");
      return;
    }
    if (weightTotal !== 100) {
      toast(`Child weights total ${weightTotal}% — they must total exactly 100%`, "error");
      return;
    }
    setBusy(true);
    try {
      await setTermWeights(weightsFor.id, payload);
      toast("Annual weights saved", "success");
      setWeightsFor(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save weights", "error");
    } finally {
      setBusy(false);
    }
  };

  const weightTotal = useMemo(
    () => Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [weights],
  );
  const annualChildren = weightsFor
    ? terms.filter((term) => term.termType === "TERMINAL" && term.id !== weightsFor.id)
    : [];

  return (
    <div className="space-y-4">
      <DashPageHeader
        title="Exam Terms & CT Rules"
        description="Spec §PHASE 3 — terms, CT aggregation, annual weights, rounding and the CC-18 status machine."
      />

      <FilterCard title="Filter exam terms">
        <ScopeSelect label="Academic Session" value={sessionId} onChange={setSessionId} options={sessions} placeholder="Select session" isClearable={false} />
        <ScopeSelect label="Class / Dept" value={classId} onChange={setClassId} options={classes} placeholder="Select class" isClearable={false} />
        <ScopeSelect label="Term type" value={termType} onChange={setTermType} options={options(TERM_TYPES)} placeholder="All types" />
        <ScopeSelect label="Status" value={status} onChange={setStatus} options={options(TERM_STATUSES)} placeholder="All statuses" />
        <ActionCell>
          <button type="button" className={BTN} onClick={() => void load()} disabled={!sessionId || !classId}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={openCreate} disabled={!sessionId || !classId}>
            <Plus className="h-3.5 w-3.5" />
            New term
          </button>
        </ActionCell>
      </FilterCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Terms" value={String(terms.length)} />
        <KpiTile label="Terminal" value={String(terms.filter((term) => term.termType === "TERMINAL").length)} />
        <KpiTile label="Annual" value={String(terms.filter((term) => term.termType === "CUMULATIVE_ANNUAL").length)} tone="navy" />
        <KpiTile label="Marks entry open" value={String(terms.filter((term) => term.status === "MARKS_ENTRY").length)} tone="emerald" />
      </div>

      <DashCard title="Exam terms">
        {loading ? (
          <AdminPageLoader variant="inline" />
        ) : !sessionId || !classId ? (
          <p className="py-6 text-center text-xs text-ink-400">Pick an academic session and class to list its exam terms.</p>
        ) : (
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Term</th>
                  <th className="px-2.5 py-1.5 font-semibold">Type</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Seq</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 font-semibold">Scale</th>
                  <th className="px-2.5 py-1.5 font-semibold">CT rule</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Annual %</th>
                  <th className="px-2.5 py-1.5 font-semibold">Rounding</th>
                  <th className="px-2.5 py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {terms.length === 0 ? (
                  <EmptyRow colSpan={9} message="No exam terms for this filter." />
                ) : (
                  terms.map((term) => (
                    <tr key={term.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{term.termName}</td>
                      <td className="px-2.5 py-1 text-ink-600">{term.termType.replace(/_/g, " ")}</td>
                      <td className="px-2.5 py-1 text-right font-mono">{term.sequenceNo}</td>
                      <td className="px-2.5 py-1">
                        <StatusBadge status={term.status} />
                      </td>
                      <td className="px-2.5 py-1 text-ink-600">{scaleName(term.gradingScaleId)}</td>
                      <td className="px-2.5 py-1 text-ink-600">
                        {term.ctAggregationMode.replace(/_/g, " ")} (best {term.ctBestCount})
                      </td>
                      <td className="px-2.5 py-1 text-right font-mono">{fmt2(term.annualWeightPct)}</td>
                      <td className="px-2.5 py-1 text-ink-600">{term.markRoundingMode.replace(/_/g, " ")}</td>
                      <td className="px-2.5 py-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <button type="button" className={BTN_ROW} onClick={() => openEdit(term)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          {term.termType === "CUMULATIVE_ANNUAL" && (
                            <button type="button" className={BTN_ROW} onClick={() => void openWeights(term)}>
                              <Scale className="h-3 w-3" />
                              Weights
                            </button>
                          )}
                          {nextStatuses(term.status).map((target) => (
                            <button
                              key={target}
                              type="button"
                              className={`${BTN_ROW} ${target === "MARKS_ENTRY" && term.status === "PUBLISHED" ? "text-amber-700" : ""}`}
                              onClick={() => void transition(term, target)}
                            >
                              → {target.replace(/_/g, " ")}
                            </button>
                          ))}
                          {term.status === "SETUP" && (
                            <button type="button" className={`${BTN_ROW} text-rose-700`} onClick={() => void removeTerm(term)}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableWrap>
        )}
      </DashCard>

      {form && (
        <Modal
          wide
          title={form.id ? "Edit exam term" : "New exam term"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void saveTerm()} disabled={busy}>
                {busy ? "Saving…" : "Save term"}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Term name">
              <input className={INPUT} value={form.termName} onChange={(e) => setForm({ ...form, termName: e.target.value })} placeholder="e.g. Half-Yearly 2026" />
            </Field>
            {!form.id && (
              <ScopeSelect
                label="Term type"
                value={form.termType}
                onChange={(value) => setForm({ ...form, termType: value })}
                options={options(TERM_TYPES)}
                placeholder="Select type"
                isClearable={false}
              />
            )}
            <ScopeSelect
              label="Grading scale"
              value={form.gradingScaleId}
              onChange={(value) => setForm({ ...form, gradingScaleId: value })}
              options={scaleOptions}
              placeholder="Select scale"
              isClearable={false}
            />
            <ScopeSelect
              label="Parent terminal exam"
              value={form.parentTerminalExamId}
              onChange={(value) => setForm({ ...form, parentTerminalExamId: value })}
              options={terminalOptions}
              placeholder="None"
            />
            <Field label="Sequence no">
              <input className={INPUT} value={form.sequenceNo} onChange={(e) => setForm({ ...form, sequenceNo: e.target.value })} />
            </Field>
            <ScopeSelect
              label="CT aggregation"
              value={form.ctAggregationMode}
              onChange={(value) => setForm({ ...form, ctAggregationMode: value })}
              options={options(CT_AGGREGATION_MODES)}
              placeholder="Select mode"
              isClearable={false}
            />
            <Field label="CT best count">
              <input className={INPUT} value={form.ctBestCount} onChange={(e) => setForm({ ...form, ctBestCount: e.target.value })} />
            </Field>
            <Field label="Annual weight %">
              <input className={INPUT} value={form.annualWeightPct} onChange={(e) => setForm({ ...form, annualWeightPct: e.target.value })} />
            </Field>
            <ScopeSelect
              label="Mark rounding"
              value={form.markRoundingMode}
              onChange={(value) => setForm({ ...form, markRoundingMode: value })}
              options={options(MARK_ROUNDING_MODES)}
              placeholder="Select rounding"
              isClearable={false}
            />
            <Field label="Min courses to promote">
              <input className={INPUT} value={form.minCoursesToPromote} onChange={(e) => setForm({ ...form, minCoursesToPromote: e.target.value })} />
            </Field>
            <Field label="Min CGPA to promote">
              <input className={INPUT} value={form.minCgpaToPromote} onChange={(e) => setForm({ ...form, minCgpaToPromote: e.target.value })} />
            </Field>
          </div>
          {form.id && (
            <p className="mt-2 text-[11px] text-ink-500">
              Session, class and term type are immutable after creation — create a new term instead.
            </p>
          )}
        </Modal>
      )}

      {weightsFor && (
        <Modal
          wide
          title={`Annual weights — ${weightsFor.termName}`}
          onClose={() => setWeightsFor(null)}
          footer={
            <>
              <button type="button" className={BTN_MODAL} onClick={() => setWeightsFor(null)}>
                Cancel
              </button>
              <button type="button" className={BTN_MODAL_PRIMARY} onClick={() => void saveWeights()} disabled={busy || weightTotal !== 100}>
                {busy ? "Saving…" : "Save weights"}
              </button>
            </>
          }
        >
          <p className="mb-3 text-xs text-ink-600">
            Every terminal term of this session/class contributes a share of the annual result. Weights must total exactly 100.
            Children must be PUBLISHED before the annual term can be generated.
          </p>
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50 text-ink-700">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">Child terminal</th>
                  <th className="px-2.5 py-1.5 font-semibold">Status</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Weight %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-white">
                {annualChildren.length === 0 ? (
                  <EmptyRow colSpan={3} message="No terminal terms in this session/class." />
                ) : (
                  annualChildren.map((child) => (
                    <tr key={child.id} className="hover:bg-ink-50">
                      <td className="px-2.5 py-1 font-medium">{child.termName}</td>
                      <td className="px-2.5 py-1">
                        <StatusBadge status={child.status} />
                      </td>
                      <td className="px-2.5 py-1">
                        <input
                          className={`${INPUT} text-right font-mono`}
                          value={weights[child.id] ?? ""}
                          onChange={(event) => setWeights({ ...weights, [child.id]: event.target.value })}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-ink-300 bg-ink-100 font-semibold">
                <tr>
                  <td className="px-2.5 py-1.5" colSpan={2}>
                    Total
                  </td>
                  <td className={`px-2.5 py-1.5 text-right font-mono ${weightTotal === 100 ? "text-emerald-700" : "text-rose-700"}`}>
                    {fmt2(weightTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-500">
            <Sliders className="h-3 w-3" />
            Weights can only be edited while the annual term is in SETUP.
          </p>
        </Modal>
      )}
    </div>
  );
}
