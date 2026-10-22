"use client";

import Link from "next/link";
import { PriorityBadge, StatusBadge } from "./status";
import { IconCopy } from "./icons";
import { formatDate } from "@/lib/format";
import { localizedName, type Locale } from "@/lib/i18n";
import type { RequestRowView } from "./requests-table";

type Column = {
  id: string;
  title: string;
  statuses: string[];
  tone: string;
};

const COLUMNS: Column[] = [
  {
    id: "new",
    title: "Нові та чернетки",
    statuses: ["draft", "submitted"],
    tone: "border-t-blue-500",
  },
  {
    id: "review",
    title: "На погодженні",
    statuses: ["in_review", "needs_info"],
    tone: "border-t-amber-500",
  },
  {
    id: "procurement",
    title: "У закупівлі",
    statuses: ["purchasing", "ordered"],
    tone: "border-t-teal-500",
  },
  {
    id: "completed",
    title: "Завершені",
    statuses: ["completed", "rejected", "cancelled"],
    tone: "border-t-emerald-500",
  },
];

export function RequestsKanban({
  rows,
  locale,
}: {
  rows: RequestRowView[];
  locale: Locale;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const columnRows = rows.filter((r) => col.statuses.includes(r.status));
        return (
          <div
            key={col.id}
            className={`flex flex-col rounded-xl border border-slate-200/90 border-t-4 bg-slate-50/60 p-3 shadow-2xs ${col.tone}`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {col.title}
              </h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                {columnRows.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
              {columnRows.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  Немає заявок
                </div>
              ) : (
                columnRows.map((row) => (
                  <div
                    key={row.id}
                    className="group rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-xs transition hover:border-[#12325c] hover:shadow-md"
                  >
                    <Link href={`/requests/${row.id}`} className="block">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-xs text-[#12325c] group-hover:underline">
                          {row.number}
                        </span>
                        <PriorityBadge priority={row.priority} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.status} />
                      </div>

                      <div className="mt-2.5 space-y-1 text-[11px] text-slate-600">
                        <p className="truncate">
                          <span className="text-slate-400">Напрям:</span>{" "}
                          {localizedName(locale, {
                            nameRu: row.departmentNameRu,
                            nameUk: row.departmentNameUk,
                          })}
                        </p>
                        <p className="truncate">
                          <span className="text-slate-400">Цех:</span>{" "}
                          {localizedName(locale, {
                            nameRu: row.workshopNameRu,
                            nameUk: row.workshopNameUk,
                          })}
                        </p>
                        {row.authorName ? (
                          <p className="truncate">
                            <span className="text-slate-400">Автор:</span> {row.authorName}
                          </p>
                        ) : null}
                      </div>
                    </Link>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <span className="text-[11px] font-medium text-slate-500">
                        {row.itemCount} поз.
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">
                          {formatDate(row.createdAt)}
                        </span>
                        <Link
                          href={`/requests/new?copyFrom=${row.id}`}
                          title="Створити на основі цієї заявки"
                          className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
                        >
                          <IconCopy className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
