"use client";

import { useMemo, useState } from "react";
import {
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiSearch,
  FiFilter,
} from "react-icons/fi";
import { resolveImageUrl } from "@/lib/media";
import SearchSelect from "@/components/ui/SearchSelect";

export interface RoutineItem {
  id: string;
  title: string;
  titleBn?: string | null;
  academicSessionId: string;
  classOrDeptId: string;
  academicGroupId?: string | null;
  type: string;
  pdfUrl: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  academicSession?: {
    id: string;
    sessionName: string;
    sessionCode: string;
    isCurrent?: boolean;
  } | null;
  classOrDept?: {
    id: string;
    name: string;
    code: string;
    level?: string;
  } | null;
  academicGroup?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface RoutineListViewProps {
  initialRoutines: RoutineItem[];
  locale?: string;
}

export default function RoutineListView({
  initialRoutines,
  locale = "en",
}: RoutineListViewProps) {
  const [search, setSearch] = useState("");
  const [filterSession, setFilterSession] = useState<string>("");
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  // Collect unique sessions from routines
  const sessionOptions = useMemo(() => {
    const map = new Map<string, string>();
    initialRoutines.forEach((r) => {
      if (r.academicSession) {
        map.set(
          r.academicSession.id,
          `${r.academicSession.sessionName || r.academicSession.sessionCode}${
            r.academicSession.isCurrent ? " (Current)" : ""
          }`,
        );
      }
    });
    return [
      { value: "", label: "All Sessions" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [initialRoutines]);

  // Collect unique classes from routines
  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    initialRoutines.forEach((r) => {
      if (r.classOrDept) {
        map.set(r.classOrDept.id, r.classOrDept.name || r.classOrDept.code);
      }
    });
    return [
      { value: "", label: "All Classes / Depts" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [initialRoutines]);

  // Collect unique groups from routines
  const groupOptions = useMemo(() => {
    const map = new Map<string, string>();
    initialRoutines.forEach((r) => {
      if (r.academicGroup) {
        map.set(r.academicGroup.id, r.academicGroup.name || r.academicGroup.code);
      }
    });
    return [
      { value: "", label: "All Groups" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [initialRoutines]);

  const typeOptions = [
    { value: "", label: "All Routine Types" },
    { value: "CLASS", label: "Class Routine" },
    { value: "EXAM", label: "Exam Routine" },
  ];

  // Filtered routines list
  const filteredRoutines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRoutines.filter((r) => {
      if (filterSession && r.academicSessionId !== filterSession) return false;
      if (filterClass && r.classOrDeptId !== filterClass) return false;
      if (filterGroup && r.academicGroupId !== filterGroup) return false;
      if (filterType && r.type !== filterType) return false;

      if (q) {
        const titleMatch = r.title.toLowerCase().includes(q);
        const titleBnMatch = r.titleBn?.toLowerCase().includes(q);
        const descMatch = r.description?.toLowerCase().includes(q);
        const classMatch = r.classOrDept?.name.toLowerCase().includes(q);
        const groupMatch = r.academicGroup?.name.toLowerCase().includes(q);
        if (!titleMatch && !titleBnMatch && !descMatch && !classMatch && !groupMatch) {
          return false;
        }
      }
      return true;
    });
  }, [initialRoutines, search, filterSession, filterClass, filterGroup, filterType]);

  function handleReset() {
    setSearch("");
    setFilterSession("");
    setFilterClass("");
    setFilterGroup("");
    setFilterType("");
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="rounded-xs border border-ink-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900">
            <FiFilter className="h-3.5 w-3.5 text-brand-600" />
            <span>Filter Routines by Class & Session</span>
          </div>
          {(search || filterSession || filterClass || filterGroup || filterType) && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Keyword Search */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Search Routine
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title..."
                className="w-full rounded-xs border border-ink-200 bg-white py-1 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-brand-400"
              />
              <FiSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
            </div>
          </div>

          {/* Academic Session */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Academic Session
            </label>
            <SearchSelect
              options={sessionOptions}
              value={filterSession}
              onChange={setFilterSession}
              placeholder="All Sessions"
              isClearable
            />
          </div>

          {/* Class / Dept */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Class / Dept
            </label>
            <SearchSelect
              options={classOptions}
              value={filterClass}
              onChange={setFilterClass}
              placeholder="All Classes"
              isClearable
            />
          </div>

          {/* Academic Group */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Group
            </label>
            <SearchSelect
              options={groupOptions}
              value={filterGroup}
              onChange={setFilterGroup}
              placeholder="All Groups"
              isClearable
            />
          </div>

          {/* Routine Type */}
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-ink-700">
              Routine Type
            </label>
            <SearchSelect
              options={typeOptions}
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
              isClearable
            />
          </div>
        </div>
      </div>

      {/* Routine Listing Table */}
      {filteredRoutines.length > 0 ? (
        <div className="overflow-x-auto rounded-xs border border-ink-200 bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-ink-700">
              <tr>
                <th className="px-4 py-3 font-semibold">SI</th>
                <th className="px-4 py-3 font-semibold">Routine Name</th>
                <th className="px-4 py-3 font-semibold">Class / Dept</th>
                <th className="px-4 py-3 font-semibold">Group</th>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 text-center font-semibold">Download PDF</th>
                <th className="px-4 py-3 text-center font-semibold">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredRoutines.map((routine, i) => {
                const title = (locale === "bn" && routine.titleBn) || routine.title;
                const pdfHref = resolveImageUrl(routine.pdfUrl);

                return (
                  <tr key={routine.id} className="align-middle hover:bg-ink-50">
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 shrink-0 rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${
                            routine.type === "EXAM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {routine.type === "EXAM" ? "Exam" : "Class"}
                        </span>
                        <div>
                          <p className="font-semibold text-navy-900">{title}</p>
                          {routine.description && (
                            <p className="mt-0.5 text-xs text-ink-500 line-clamp-1">
                              {routine.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-navy-800">
                        {routine.classOrDept?.name || routine.classOrDept?.code || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {routine.academicGroup ? (
                        <span className="rounded-xs bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          {routine.academicGroup.name || routine.academicGroup.code}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-600">
                      {routine.academicSession?.sessionName || routine.academicSession?.sessionCode || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {routine.pdfUrl ? (
                        <a
                          href={pdfHref}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download Routine PDF"
                          className="inline-flex items-center gap-1.5 rounded-xs border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white"
                        >
                          <FiDownload className="h-3.5 w-3.5 text-red-600" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {routine.pdfUrl ? (
                        <a
                          href={pdfHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview in new tab"
                          className="inline-flex items-center gap-1 rounded-xs border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:border-brand-400 hover:text-brand-600"
                        >
                          <FiFileText className="h-3.5 w-3.5 text-ink-500" />
                          <span>View</span>
                          <FiExternalLink className="h-3 w-3 text-ink-400" />
                        </a>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xs border border-ink-200 bg-white p-12 text-center shadow-soft">
          <FiFileText className="mx-auto h-12 w-12 text-ink-300" />
          <h3 className="mt-3 font-display text-base font-semibold text-navy-900">
            No routines found
          </h3>
          <p className="mt-1 text-xs text-ink-500">
            There are currently no routines matching your selected filters. Please check back later or reset your filters.
          </p>
          {(search || filterSession || filterClass || filterGroup || filterType) && (
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 rounded-xs border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
