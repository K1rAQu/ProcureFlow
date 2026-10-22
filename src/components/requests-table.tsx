"use client";

import Link from "next/link";
import { EmptyState } from "./ui";
import { PriorityBadge, StatusBadge } from "./status";
import { IconCopy } from "./icons";
import { formatDate, initials } from "@/lib/format";
import { localizedName, type Locale } from "@/lib/i18n";

export type RequestRowView = {
  id: number;
  number: string;
  status: string;
  priority: string;
  createdAt: Date | string;
  desiredDate?: string | null;
  departmentNameRu: string;
  departmentNameUk: string;
  workshopNameRu: string;
  workshopNameUk: string;
  authorName: string;
  itemCount: number;
  totals?: { currency: string; total: number }[];
};

export function RequestsTable({
  rows,
  locale,
  labels,
  showAuthor = false,
}: {
  rows: RequestRowView[];
  locale: Locale;
  labels: {
    number: string;
    status: string;
    department: string;
    workshop: string;
    author: string;
    created: string;
    total?: string;
    empty: string;
    items: string;
  };
  showAuthor?: boolean;
}) {
  if (!rows.length) return <EmptyState title={labels.empty} description="Спробуйте змінити фільтри або створити нову заявку" />;

  return (
    <>
      {/* Десктоп / планшет таблиця */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">{labels.number}</th>
              <th className="px-4 py-3">{labels.status}</th>
              <th className="px-4 py-3">{labels.department}</th>
              <th className="px-4 py-3">{labels.workshop}</th>
              {showAuthor ? <th className="px-4 py-3">{labels.author}</th> : null}
              <th className="px-4 py-3 text-center">{labels.items}</th>
              <th className="px-5 py-3 text-right">{labels.created}</th>
              <th className="px-3 py-3 text-center w-12">Копія</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="group cursor-pointer transition hover:bg-slate-50/80"
              >
                <td className="px-5 py-3.5">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/requests/${row.id}`}
                      className="font-semibold text-xs text-[#12325c] group-hover:underline"
                    >
                      {row.number}
                    </Link>
                    <div>
                      <PriorityBadge priority={row.priority} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-700">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {localizedName(locale, { nameRu: row.departmentNameRu, nameUk: row.departmentNameUk })}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-600">
                  {localizedName(locale, { nameRu: row.workshopNameRu, nameUk: row.workshopNameUk })}
                </td>
                {showAuthor ? (
                  <td className="px-4 py-3.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
                        {initials(row.authorName)}
                      </span>
                      <span className="truncate max-w-[140px]">{row.authorName}</span>
                    </div>
                  </td>
                ) : null}
                <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600">
                  {row.itemCount}
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                  <Link
                    href={`/requests/new?copyFrom=${row.id}`}
                    title="Створити на основі цієї заявки"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  >
                    <IconCopy className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Мобільні картки */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="p-4 transition hover:bg-slate-50">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/requests/${row.id}`}
                className="font-bold text-sm text-[#12325c] hover:underline"
              >
                {row.number}
              </Link>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={row.status} />
                <Link
                  href={`/requests/new?copyFrom=${row.id}`}
                  title="Створити на основі"
                  className="rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  <IconCopy className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <PriorityBadge priority={row.priority} />
              <span className="text-xs text-slate-500">
                {localizedName(locale, { nameRu: row.departmentNameRu, nameUk: row.departmentNameUk })} ·{" "}
                {localizedName(locale, { nameRu: row.workshopNameRu, nameUk: row.workshopNameUk })}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
              <span className="text-slate-500">
                {labels.items}: <span className="font-semibold text-slate-800">{row.itemCount}</span>
              </span>
              <span className="text-slate-400">{formatDate(row.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
