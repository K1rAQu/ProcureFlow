import Link from "next/link";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { requestEvents, requests, users } from "@/db/schema";
import { Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { pageContext } from "@/lib/page";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, t } = await pageContext();
  const canViewAll = user.permissions.includes("requests.view_all");

  const visibility = canViewAll
    ? undefined
    : or(
        eq(requests.authorId, user.id),
        eq(requests.assigneeId, user.id),
        user.permissions.includes("requests.view_workshop") && user.workshopId
          ? eq(requests.workshopId, user.workshopId)
          : sql`0 = 1`,
      );

  const statusRows = await db
    .select({ status: requests.status, value: sql<number>`count(*)` })
    .from(requests)
    .where(visibility)
    .groupBy(requests.status);

  const counts = new Map(statusRows.map((row) => [row.status, row.value]));
  const totalRequests = statusRows.reduce((sum, row) => sum + row.value, 0);
  const inWork = ["submitted", "in_review", "purchasing", "ordered"].reduce(
    (sum, status) => sum + (counts.get(status) ?? 0),
    0,
  );

  const [{ value: myOpen } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(requests)
    .where(
      and(
        eq(requests.authorId, user.id),
        inArray(requests.status, ["draft", "submitted", "in_review", "needs_info", "purchasing", "ordered"]),
      ),
    );

  const [{ value: assignedToMe } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(requests)
    .where(and(eq(requests.assigneeId, user.id), inArray(requests.status, ["in_review", "purchasing", "ordered"])));

  const latest = await db
    .select({
      id: requests.id,
      number: requests.number,
      status: requests.status,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(eq(requests.authorId, user.id))
    .orderBy(desc(requests.createdAt))
    .limit(6);

  const events = await db
    .select({
      id: requestEvents.id,
      type: requestEvents.type,
      toStatus: requestEvents.toStatus,
      message: requestEvents.message,
      createdAt: requestEvents.createdAt,
      requestId: requestEvents.requestId,
      number: requests.number,
      userName: users.fullName,
    })
    .from(requestEvents)
    .innerJoin(requests, eq(requests.id, requestEvents.requestId))
    .leftJoin(users, eq(users.id, requestEvents.userId))
    .where(visibility)
    .orderBy(desc(requestEvents.createdAt))
    .limit(10);

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        description={t("app.subtitle")}
        actions={
          user.permissions.includes("requests.create") ? (
            <Link
              href="/requests/new"
              className="rounded-lg bg-[#12325c] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#0b1b33]"
            >
              + {t("nav.newRequest")}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("dash.total")} value={totalRequests} tone="slate" />
        <StatTile label={t("dash.inWork")} value={inWork} tone="blue" />
        <StatTile label={t("dash.needsInfo")} value={counts.get("needs_info") ?? 0} tone="amber" />
        <StatTile label={t("dash.completed")} value={counts.get("completed") ?? 0} tone="green" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("dash.recentEvents")}
            actions={
              <Link href="/requests" className="text-xs text-slate-500 hover:text-slate-800">
                {t("nav.myRequests")} →
              </Link>
            }
          />
          {events.length === 0 ? (
            <EmptyState title={t("dash.noEvents")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                  <Link href={`/requests/${event.requestId}`} className="font-medium text-[#12325c] hover:underline">
                    {event.number}
                  </Link>
                  <span className="text-xs text-slate-500">{t(`event.${event.type}`)}</span>
                  {event.toStatus ? <StatusBadge status={event.toStatus} /> : null}
                  {event.message ? (
                    <span className="max-w-full truncate text-xs text-slate-400">{event.message}</span>
                  ) : null}
                  <span className="ml-auto text-xs text-slate-400">
                    {event.userName ?? "—"} · {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatTile label={t("dash.myOpen")} value={myOpen} />
            <StatTile label={t("dash.assignedToMe")} value={assignedToMe} />
          </div>
          <Card>
            <CardHeader title={t("request.myTitle")} />
            {latest.length === 0 ? (
              <EmptyState title={t("request.none")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {latest.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/requests/${row.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2 text-sm transition hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{row.number}</span>
                      <StatusBadge status={row.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
