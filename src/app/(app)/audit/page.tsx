import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AuditFilters } from "@/components/audit-filters";
import { pageContext, readNumberParam, readParam } from "@/lib/page";
import { formatDateTime, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

function getActionBadge(action: string) {
  const norm = action.toLowerCase();
  if (norm.includes("create") || norm.includes("new")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }
  if (norm.includes("delete") || norm.includes("cancel") || norm.includes("reject")) {
    return "bg-rose-50 text-rose-700 ring-rose-600/20";
  }
  if (norm.includes("status")) {
    return "bg-indigo-50 text-indigo-700 ring-indigo-600/20";
  }
  if (norm.includes("update") || norm.includes("edit")) {
    return "bg-sky-50 text-sky-700 ring-sky-600/20";
  }
  if (norm.includes("backup") || norm.includes("restore") || norm.includes("vacuum") || norm.includes("clean")) {
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }
  if (norm.includes("login") || norm.includes("auth")) {
    return "bg-teal-50 text-teal-700 ring-teal-600/20";
  }
  return "bg-slate-100 text-slate-700 ring-slate-600/20";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, t } = await pageContext();
  if (!user.permissions.includes("audit.view")) redirect("/");

  const params = await searchParams;
  const page = readNumberParam(params, "page") ?? 1;
  const pageSize = 30;
  const entityType = readParam(params, "entityType");
  const auditAction = readParam(params, "auditAction");
  const userId = readNumberParam(params, "userId");
  const dateFrom = readParam(params, "dateFrom");
  const dateTo = readParam(params, "dateTo");
  const query = readParam(params, "q");

  // Завантажуємо список користувачів для випадаючого списку фільтра
  const allUsers = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .orderBy(asc(users.fullName));

  const conditions: SQL[] = [];
  if (entityType && entityType !== "all") {
    conditions.push(eq(auditLog.entityType, entityType));
  }
  if (auditAction && auditAction !== "all") {
    conditions.push(eq(auditLog.action, auditAction));
  }
  if (userId && userId > 0) {
    conditions.push(eq(auditLog.userId, userId));
  }
  if (dateFrom) {
    conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(auditLog.createdAt, new Date(`${dateTo}T23:59:59.999Z`)));
  }
  if (query) {
    const likePattern = `%${query.toLowerCase().replace(/[%_]/g, (match) => `\\${match}`)}%`;
    conditions.push(
      or(
        like(sql`lower(coalesce(${auditLog.summary}, ''))`, likePattern),
        like(sql`lower(coalesce(${auditLog.entityId}, ''))`, likePattern),
        like(sql`lower(coalesce(${auditLog.action}, ''))`, likePattern),
        like(sql`lower(coalesce(${auditLog.entityType}, ''))`, likePattern),
        like(sql`lower(coalesce(${auditLog.ip}, ''))`, likePattern),
        sql`exists (
          select 1 from users u
          where u.id = ${auditLog.userId}
            and lower(u.full_name) like ${likePattern}
        )`,
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
      ip: auditLog.ip,
      userName: users.fullName,
      userAvatar: users.avatarUrl,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(auditLog)
    .where(where);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  function buildUrl(patch: Record<string, string | undefined>): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") next.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    return `/audit?${next.toString()}`;
  }

  return (
    <>
      <PageHeader
        title={t("audit.title")}
        description={`Усього подій в системі: ${total}`}
      />

      <div className="mb-4">
        <AuditFilters
          action="/audit"
          users={allUsers}
          values={{
            q: query,
            entityType,
            auditAction,
            userId: userId ? String(userId) : undefined,
            dateFrom,
            dateTo,
          }}
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title={t("audit.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">{t("audit.when")}</th>
                  <th className="px-4 py-3">{t("audit.user")}</th>
                  <th className="px-4 py-3">{t("audit.action")}</th>
                  <th className="px-4 py-3">{t("audit.entity")}</th>
                  <th className="px-4 py-3">{t("common.comment")}</th>
                  <th className="px-4 py-3 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  let entityLink: string | null = null;
                  if (row.entityType === "request" && row.entityId) {
                    entityLink = `/requests/${row.entityId}`;
                  } else if (row.entityType === "nomenclature" && row.entityId) {
                    entityLink = `/nomenclature/${row.entityId}`;
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 font-mono">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.userAvatar}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                            />
                          ) : (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">
                              {row.userName ? initials(row.userName) : "—"}
                            </span>
                          )}
                          <span className="font-medium text-slate-800 text-xs">
                            {row.userName ?? "Система / Гість"}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getActionBadge(
                            row.action,
                          )}`}
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {entityLink ? (
                          <Link
                            href={entityLink}
                            className="inline-flex items-center gap-1 font-semibold text-[#12325c] hover:underline"
                          >
                            <span>{row.entityType}</span>
                            <span className="font-mono text-slate-500">#{row.entityId}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-600">
                            {row.entityType}
                            {row.entityId ? ` #${row.entityId}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md break-words">
                        {row.summary ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                        {row.ip ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">
                            {row.ip}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Пагінація */}
      {pages > 1 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Сторінка <span className="font-semibold text-slate-900">{page}</span> з{" "}
            <span className="font-semibold text-slate-900">{pages}</span> (показано {rows.length} з {total})
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            {page > 1 ? (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                ← Попередня
              </Link>
            ) : null}

            {Array.from({ length: pages }, (_, index) => index + 1)
              .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
              .map((item, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && item - prev > 1;

                return (
                  <span key={item} className="flex items-center gap-1.5">
                    {showEllipsis ? <span className="px-1 text-slate-400">…</span> : null}
                    <Link
                      href={buildUrl({ page: String(item) })}
                      className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                        page === item
                          ? "bg-[#12325c] text-white shadow-2xs"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </Link>
                  </span>
                );
              })}

            {page < pages ? (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Наступна →
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
