import { redirect } from "next/navigation";
import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { pageContext, readNumberParam, readParam } from "@/lib/page";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = ["request", "nomenclature", "user", "role", "workshops", "departments", "units", "settings"];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, t } = await pageContext();
  if (!user.permissions.includes("audit.view")) redirect("/");

  const params = await searchParams;
  const page = readNumberParam(params, "page") ?? 1;
  const pageSize = 50;
  const entityType = readParam(params, "entityType");
  const query = readParam(params, "q");

  const conditions: SQL[] = [];
  if (entityType && entityType !== "all") conditions.push(eq(auditLog.entityType, entityType));
  if (query) conditions.push(sql`lower(${auditLog.summary}) like ${'%' + query.toLowerCase() + '%'}`);
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

  return (
    <>
      <PageHeader title={t("audit.title")} description={`${t("common.total")}: ${total}`} />

      <Card className="mb-4">
        <FilterForm action="/audit">
          <Field label={t("common.search")} className="lg:col-span-3">
            <Input name="q" defaultValue={query ?? ""} />
          </Field>
          <Field label={t("audit.entity")}>
            <Select name="entityType" defaultValue={entityType ?? "all"}>
              <option value="all">{t("common.all")}</option>
              {ENTITY_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </FilterForm>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title={t("audit.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t("audit.when")}</th>
                  <th className="px-4 py-2">{t("audit.user")}</th>
                  <th className="px-4 py-2">{t("audit.action")}</th>
                  <th className="px-4 py-2">{t("audit.entity")}</th>
                  <th className="px-4 py-2">{t("common.comment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{row.userName ?? "—"}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{row.action}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {row.entityType}
                      {row.entityId ? ` #${row.entityId}` : ""}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">{row.summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
