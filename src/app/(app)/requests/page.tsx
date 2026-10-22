import Link from "next/link";
import { cookies } from "next/headers";
import { Button, Card, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { RequestFilters } from "@/components/request-filters";
import { RequestsTable } from "@/components/requests-table";
import { RequestsKanban } from "@/components/requests-kanban";
import { RefreshControl } from "@/components/refresh-control";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { ExportCsvButton } from "@/components/export-button";
import { listRequests } from "@/lib/requests-service";
import { loadDirectories, pageContext, readNumberParam, readParam } from "@/lib/page";
import { localizedName } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, locale, t } = await pageContext();
  const params = await searchParams;
  const { departments, workshops } = await loadDirectories(false);
  const page = readNumberParam(params, "page") ?? 1;

  const cookieStore = await cookies();
  const savedView = cookieStore.get("procurement_view_mode")?.value;
  const rawView = readParam(params, "view") ?? (savedView === "table" ? "table" : "kanban");
  const view: "kanban" | "table" = rawView === "table" ? "table" : "kanban";

  const currentStatus = readParam(params, "status");
  const activeDepartment = readParam(params, "departmentId");
  const activePriority = readParam(params, "priority");

  const result = await listRequests(user, {
    scope: "own",
    status: currentStatus,
    departmentId: readNumberParam(params, "departmentId"),
    workshopId: readNumberParam(params, "workshopId"),
    priority: readParam(params, "priority"),
    query: readParam(params, "q"),
    dateFrom: readParam(params, "dateFrom"),
    dateTo: readParam(params, "dateTo"),
    sort: readParam(params, "sort"),
    page,
    pageSize: view === "kanban" ? 60 : 20,
  });

  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildUrl(patch: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") next.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    return `/requests?${next.toString()}`;
  }

  const statusTabs = [
    { label: t("common.all"), value: undefined },
    { label: t("status.needs_info"), value: "needs_info" },
    { label: t("status.submitted"), value: "submitted" },
    { label: t("status.in_review"), value: "in_review" },
    { label: t("status.purchasing"), value: "purchasing" },
    { label: t("status.completed"), value: "completed" },
    { label: t("status.draft"), value: "draft" },
  ];

  const priorityTabs = [
    { label: t("priority.all"), value: undefined },
    { label: t("priority.normal"), value: "normal" },
    { label: t("priority.high"), value: "high" },
    { label: t("priority.urgent"), value: "urgent" },
  ];

  return (
    <>
      <PageHeader
        title={t("request.myTitle")}
        description={`${t("common.total")}: ${result.total}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RefreshControl />
            <ExportCsvButton endpoint="/api/export/requests" defaultParams={{ mine: "1" }} />
            <ViewModeToggle currentView={view} />

            {user.permissions.includes("requests.create") ? (
              <Link
                href="/requests/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#12325c] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0b1b33]"
              >
                <IconPlus className="h-4 w-4" /> {t("nav.newRequest")}
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Швидкий наскрізний пошук та розкривні фільтри */}
      <div className="mb-4">
        <RequestFilters
          action="/requests"
          locale={locale}
          departments={departments}
          workshops={workshops}
          values={{
            q: readParam(params, "q"),
            status: readParam(params, "status"),
            departmentId: readParam(params, "departmentId"),
            workshopId: readParam(params, "workshopId"),
            priority: readParam(params, "priority"),
            dateFrom: readParam(params, "dateFrom"),
            dateTo: readParam(params, "dateTo"),
            sort: readParam(params, "sort"),
            view,
          }}
        />
      </div>

      {/* Швидкі фільтри: Напрями, Статуси та Пріоритети (тогл-світч) */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        {/* Напрями закупівлі */}
        {departments.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={buildUrl({ departmentId: undefined, page: "1" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  !activeDepartment
                    ? "bg-[#12325c] text-white shadow-2xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t("filter.allDepartments")}
              </Link>
              {departments.map((department) => (
                <Link
                  key={department.id}
                  href={buildUrl({ departmentId: String(department.id), page: "1" })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeDepartment === String(department.id)
                      ? "bg-[#12325c] text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {localizedName(locale, department)}
                </Link>
              ))}
            </div>
            <div className="hidden lg:block h-6 w-px bg-slate-300 mx-1 shrink-0" aria-hidden="true" />
          </>
        ) : null}

        {/* Статусні фільтри */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusTabs.map((tab) => {
            const active = currentStatus === tab.value || (!currentStatus && tab.value === undefined);
            return (
              <Link
                key={tab.label}
                href={buildUrl({ status: tab.value, page: "1" })}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-slate-800 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden lg:block h-6 w-px bg-slate-300 mx-1 shrink-0" aria-hidden="true" />

        {/* Пріоритети (тогл-світч) */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {priorityTabs.map((tab) => {
            const active = activePriority === tab.value || (!activePriority && tab.value === undefined);
            let activeClass = "bg-slate-800 text-white shadow-2xs font-semibold";
            if (tab.value === "urgent") activeClass = "bg-rose-600 text-white shadow-2xs font-semibold";
            else if (tab.value === "high") activeClass = "bg-amber-500 text-white shadow-2xs font-semibold";
            else if (tab.value === "normal") activeClass = "bg-[#12325c] text-white shadow-2xs font-semibold";

            return (
              <Link
                key={tab.label}
                href={buildUrl({ priority: tab.value, page: "1" })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active ? activeClass : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Відображення контенту: Таблиця або Канбан */}
      {view === "kanban" ? (
        <RequestsKanban rows={result.items} locale={locale} />
      ) : (
        <Card>
          <RequestsTable
            rows={result.items}
            locale={locale}
            labels={{
              number: t("request.number"),
              status: t("common.status"),
              department: t("request.department"),
              workshop: t("request.workshop"),
              author: t("common.author"),
              created: t("common.created"),
              empty: t("request.none"),
              items: t("request.items"),
            }}
          />
        </Card>
      )}

      {pages > 1 && view !== "kanban" ? (
        <nav className="mt-5 flex flex-wrap items-center gap-1.5">
          {Array.from({ length: pages }, (_, index) => index + 1).map((item) => {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              if (typeof value === "string" && key !== "page") query.set(key, value);
            }
            query.set("page", String(item));
            return (
              <Link
                key={item}
                href={`/requests?${query.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  page === item
                    ? "bg-[#12325c] text-white ring-[#12325c]"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {item}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
