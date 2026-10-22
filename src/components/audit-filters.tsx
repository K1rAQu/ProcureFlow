"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "./ui";
import { IconFilter, IconSearch, IconX } from "./icons";
import { useT } from "./i18n-provider";

export type AuditFilterUser = {
  id: number;
  fullName: string;
};

export const AUDIT_ENTITIES = [
  { value: "request", labelUk: "Заявки", labelEn: "Requests" },
  { value: "nomenclature", labelUk: "Номенклатура", labelEn: "Nomenclature" },
  { value: "user", labelUk: "Користувачі", labelEn: "Users" },
  { value: "role", labelUk: "Ролі та права", labelEn: "Roles & Permissions" },
  { value: "departments", labelUk: "Напрями закупівлі", labelEn: "Departments" },
  { value: "workshops", labelUk: "Цехи", labelEn: "Workshops" },
  { value: "units", labelUk: "Одиниці виміру", labelEn: "Units" },
  { value: "settings", labelUk: "Налаштування системи", labelEn: "Settings" },
  { value: "backup", labelUk: "Резервні копії", labelEn: "Backups" },
  { value: "maintenance", labelUk: "Обслуговування БД", labelEn: "Maintenance" },
  { value: "auth", labelUk: "Авторизація", labelEn: "Authentication" },
];

export const AUDIT_ACTIONS = [
  { value: "create", label: "create (створення)" },
  { value: "update", label: "update (оновлення)" },
  { value: "delete", label: "delete (видалення)" },
  { value: "status_change", label: "status_change (зміна статусу)" },
  { value: "comment", label: "comment (коментар)" },
  { value: "assign", label: "assign (призначення)" },
  { value: "split", label: "split (розділення)" },
  { value: "login", label: "login (вхід)" },
  { value: "logout", label: "logout (вихід)" },
  { value: "backup", label: "backup (бекап)" },
  { value: "restore", label: "restore (відновлення)" },
  { value: "vacuum", label: "vacuum (дефрагментація)" },
];

export function AuditFilters({
  action = "/audit",
  values,
  users = [],
}: {
  action?: string;
  values: Record<string, string | undefined>;
  users?: AuditFilterUser[];
}) {
  const t = useT();
  const router = useRouter();

  const activeExtraFiltersCount = [
    values.entityType && values.entityType !== "all" ? values.entityType : null,
    values.auditAction && values.auditAction !== "all" ? values.auditAction : null,
    values.userId && values.userId !== "all" ? values.userId : null,
    values.dateFrom,
    values.dateTo,
  ].filter(Boolean).length;

  const [expanded, setExpanded] = useState<boolean>(activeExtraFiltersCount > 0);
  const [query, setQuery] = useState<string>(values.q ?? "");

  const hasAnyFilter = Boolean(values.q || activeExtraFiltersCount > 0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      const str = String(value).trim();
      if (str && str !== "all") {
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
        {/* Верхній рядок: Швидкий наскрізний пошук + кнопки керування */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Input
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("audit.searchPlaceholder")}
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
              title="Додаткові фільтри аудиту"
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

        {/* Розкривна панель параметрів */}
        {expanded ? (
          <div className="animate-fade-in border-t border-slate-100 pt-3 mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            {/* Об'єкт */}
            <Field label={t("audit.entity")}>
              <Select name="entityType" defaultValue={values.entityType ?? "all"}>
                <option value="all">{t("audit.allEntities")}</option>
                {AUDIT_ENTITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.labelUk} ({item.value})
                  </option>
                ))}
              </Select>
            </Field>

            {/* Дія */}
            <Field label={t("audit.action")}>
              <Select name="auditAction" defaultValue={values.auditAction ?? "all"}>
                <option value="all">{t("audit.allActions")}</option>
                {AUDIT_ACTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Користувач */}
            <Field label={t("audit.user")}>
              <Select name="userId" defaultValue={values.userId ?? "all"}>
                <option value="all">{t("audit.allUsers")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Дата з */}
            <Field label={t("audit.dateFrom")}>
              <Input type="date" name="dateFrom" defaultValue={values.dateFrom ?? ""} />
            </Field>

            {/* Дата по */}
            <Field label={t("audit.dateTo")}>
              <Input type="date" name="dateTo" defaultValue={values.dateTo ?? ""} />
            </Field>

            {/* Кнопка застосувати */}
            <div className="sm:col-span-2 lg:col-span-5 flex items-end justify-end gap-2 pt-1">
              <Button type="submit" variant="secondary" size="md">
                <span>Застосувати фільтри</span>
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
