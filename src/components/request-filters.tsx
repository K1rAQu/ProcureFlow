"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "./ui";
import { IconFilter, IconSearch, IconX } from "./icons";
import { PRIORITIES } from "@/lib/workflow";
import { localizedName, type Locale } from "@/lib/i18n";
import { useT } from "./i18n-provider";

export type FilterOption = { id: number; nameRu: string; nameUk: string };

export function RequestFilters({
  action,
  locale,
  departments,
  workshops,
  values,
}: {
  action: string;
  locale: Locale;
  departments: FilterOption[];
  workshops: FilterOption[];
  values: Record<string, string | undefined>;
  t?: (key: string) => string;
}) {
  const t = useT();
  const router = useRouter();

  // Рахуємо скільки активних розширених фільтрів (окрім рядка пошуку та вкладки статусу)
  const activeExtraFiltersCount = [
    values.departmentId,
    values.workshopId,
    values.priority && values.priority !== "all" ? values.priority : null,
    values.dateFrom,
    values.dateTo,
    values.sort && values.sort !== "created_desc" ? values.sort : null,
  ].filter(Boolean).length;

  const [expanded, setExpanded] = useState<boolean>(activeExtraFiltersCount > 0);
  const [query, setQuery] = useState<string>(values.q ?? "");
  const [priority, setPriority] = useState<string>(values.priority ?? "all");

  const hasAnyFilter = Boolean(values.q || activeExtraFiltersCount > 0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    // Зберігаємо поточний вигляд та статус, якщо вони є у values
    if (values.view) params.set("view", values.view);
    if (values.status && values.status !== "all") params.set("status", values.status);

    for (const [key, value] of formData.entries()) {
      const str = String(value).trim();
      if (str && str !== "all" && str !== "created_desc") {
        params.set(key, str);
      }
    }

    router.push(`${action}?${params.toString()}`);
  }

  function onClearSearch() {
    setQuery("");
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v && k !== "q" && k !== "page") params.set(k, v);
    }
    router.push(`${action}?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs">
      <form onSubmit={onSubmit} className="space-y-3">
        {/* Верхній рядок: Швидкий наскрізний пошук + кнопка Фільтри */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Input
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("request.searchPlaceholder")}
              className="pl-9 pr-8 py-2 text-sm w-full"
            />
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <IconSearch className="h-4 w-4" />
            </span>
            {query ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 rounded p-0.5"
                title="Очистити пошук"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button type="submit" variant="primary" size="md">
              <IconSearch className="h-4 w-4" />
              <span>Знайти</span>
            </Button>

            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                expanded || activeExtraFiltersCount > 0
                  ? "border-[#12325c] bg-blue-50 text-[#12325c]"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title="Розширені фільтри та сортування"
            >
              <IconFilter className="h-3.5 w-3.5" />
              <span>Фільтри</span>
              {activeExtraFiltersCount > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#12325c] px-1 text-[10px] font-bold text-white">
                  {activeExtraFiltersCount}
                </span>
              ) : null}
              <span className="text-[10px] text-slate-400">{expanded ? "▲" : "▼"}</span>
            </button>

            {hasAnyFilter ? (
              <Link
                href={action}
                className="inline-flex h-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition"
                title="Скинути всі фільтри"
              >
                <IconX className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Розкривна панель додаткових параметрів */}
        {expanded ? (
          <div className="animate-fade-in border-t border-slate-100 pt-3 mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {/* Сортування */}
            <Field label="Сортування заявок">
              <Select name="sort" defaultValue={values.sort ?? "created_desc"}>
                <option value="created_desc">За датою створення (нові спочатку)</option>
                <option value="updated_desc">За датою оновлення (нещодавно змінені)</option>
                <option value="priority_desc">За пріоритетом (термінові спочатку)</option>
                <option value="number_desc">За номером заявки</option>
                <option value="created_asc">За датою створення (старі спочатку)</option>
              </Select>
            </Field>

            {/* Напрям */}
            <Field label={t("request.department")}>
              <Select name="departmentId" defaultValue={values.departmentId ?? ""}>
                <option value="">Усі напрями</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {localizedName(locale, department)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Цех */}
            <Field label={t("request.workshop")}>
              <Select name="workshopId" defaultValue={values.workshopId ?? ""}>
                <option value="">Усі цехи</option>
                {workshops.map((workshop) => (
                  <option key={workshop.id} value={workshop.id}>
                    {localizedName(locale, workshop)}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Пріоритет (тогл-світч) */}
            <Field label={t("request.priority")}>
              <input type="hidden" name="priority" value={priority} />
              <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setPriority("all")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    priority === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t("priority.all")}
                </button>
                {PRIORITIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPriority(item)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      priority === item
                        ? item === "urgent"
                          ? "bg-rose-600 text-white shadow-2xs font-semibold"
                          : item === "high"
                            ? "bg-amber-500 text-white shadow-2xs font-semibold"
                            : "bg-[#12325c] text-white shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t(`priority.${item}`)}
                  </button>
                ))}
              </div>
            </Field>

            {/* Дати */}
            <Field label="Дата з">
              <Input type="date" name="dateFrom" defaultValue={values.dateFrom ?? ""} />
            </Field>

            <Field label="Дата по">
              <Input type="date" name="dateTo" defaultValue={values.dateTo ?? ""} />
            </Field>

            {/* Кнопка застосувати в панелі */}
            <div className="sm:col-span-2 flex items-end justify-end gap-2 pt-1">
              <Button type="submit" variant="secondary" size="md">
                <span>Застосувати параметри</span>
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
