"use client";

import type { ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

/**
 * Thin, headless wrapper around TanStack Table — styled once here so any
 * dashboard list (governing body, future rosters, etc.) gets the same
 * look by just passing `columns` + `data`. No pagination/sorting baked in;
 * add table options via `columns` meta or extend props as new needs arise.
 */
export default function DataTable<TData>({
  columns,
  data,
  emptyMessage = "No records yet.",
  footer,
}: {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  emptyMessage?: string;
  /** Optional summary row rendered in a <tfoot>, spanning the full width. */
  footer?: ReactNode;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 shadow-soft">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-ink-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border-b border-ink-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-ink-100">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-brand-50/40 ${
                  i % 2 === 1 ? "bg-ink-50/40" : "bg-white"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-ink-200 bg-ink-50">
              <td
                colSpan={columns.length}
                className="px-4 py-2.5 text-xs font-semibold text-ink-600"
              >
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
