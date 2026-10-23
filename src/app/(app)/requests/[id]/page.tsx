import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PriorityBadge, StatusBadge } from "@/components/status";
import { RequestLifecycleStepper } from "@/components/request-stepper";
import { RequestWorkflowPanel } from "@/components/request-workflow";
import { RequestDetailLayout } from "@/components/request-detail-layout";
import { RefreshControl } from "@/components/refresh-control";
import { PrintButton } from "@/components/print-button";
import { IconCopy } from "@/components/icons";
import { HttpError } from "@/lib/auth";
import { formatDateTime, formatQuantity, initials } from "@/lib/format";
import { localizedName } from "@/lib/i18n";
import { loadDirectories, pageContext } from "@/lib/page";
import { actorsFor, getRequestDetail } from "@/lib/requests-service";
import { getSettings } from "@/lib/settings";
import { availableTransitions, canEditRequest, TERMINAL_STATUSES, type RequestStatus } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, locale, t } = await pageContext();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let detail;
  try {
    detail = await getRequestDetail(id, user);
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      return (
        <Card>
          <EmptyState title={t("error.forbidden")} />
        </Card>
      );
    }
    notFound();
  }

  if (!detail) {
    notFound();
  }

  const actors = actorsFor(user, detail);
  const transitions = availableTransitions(detail.status as RequestStatus, actors);
  const settings = await getSettings();
  const editable = canEditRequest({
    status: detail.status as RequestStatus,
    isAuthor: detail.authorId === user.id,
    permissions: user.permissions,
    editableStatuses: settings.editableStatuses,
  });

  const isTerminal = TERMINAL_STATUSES.includes(detail.status as RequestStatus);
  const canAssign = user.permissions.includes("requests.assign") && !isTerminal;
  const assignees = canAssign
    ? (
        await db
          .select({ id: users.id, fullName: users.fullName, permissions: roles.permissions })
          .from(users)
          .innerJoin(roles, eq(roles.id, users.roleId))
          .where(eq(users.isActive, true))
      )
        .filter((row) => Array.isArray(row.permissions) && row.permissions.includes("requests.process"))
        .map(({ id, fullName }) => ({ id, fullName }))
    : [];

  const { departments, workshops } = await loadDirectories();

  // 1. Картка параметрів заявки
  const paramsCard = (
    <Card>
      <CardHeader
        title={t("request.detailTitle")}
        className="px-3.5 sm:px-5 py-3 sm:py-3.5"
      />
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 p-3.5 sm:p-5 text-xs sm:text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.department")}</dt>
          <dd className="mt-0.5 sm:mt-1 font-semibold text-slate-800 leading-snug">
            {localizedName(locale, { code: detail.departmentCode, nameRu: detail.departmentNameRu, nameUk: detail.departmentNameUk })}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.workshop")}</dt>
          <dd className="mt-0.5 sm:mt-1 font-semibold text-slate-800 leading-snug">
            {localizedName(locale, { code: detail.workshopCode, nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.assignee")}</dt>
          <dd className="mt-0.5 sm:mt-1 font-semibold text-slate-800 leading-snug">
            {detail.assignee ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-950">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                  {initials(detail.assignee.fullName)}
                </span>
                <span className="truncate">{detail.assignee.fullName}</span>
              </span>
            ) : (
              <span className="text-slate-400 font-normal">{t("request.noAssignee")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("common.updated")}</dt>
          <dd className="mt-0.5 sm:mt-1 font-semibold text-slate-800 leading-snug">{formatDateTime(detail.updatedAt)}</dd>
        </div>
        {detail.parent ? (
          <div>
            <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.parent")}</dt>
            <dd className="mt-0.5 sm:mt-1">
              <Link href={`/requests/${detail.parent.id}`} className="font-semibold text-[#12325c] hover:underline">
                {detail.parent.number}
              </Link>
            </dd>
          </div>
        ) : null}
        {detail.children.length ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.children")}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {detail.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/requests/${child.id}`}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-[#12325c] hover:bg-slate-200"
                >
                  {child.number}
                </Link>
              ))}
            </dd>
          </div>
        ) : null}
        {detail.comment ? (
          <div className="col-span-2 sm:col-span-3 border-t border-slate-100 pt-3">
            <dt className="text-[11px] sm:text-xs font-medium text-slate-500">{t("request.comment")}</dt>
            <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 sm:p-3 text-xs sm:text-sm text-slate-700">
              {detail.comment}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );

  // 2. Картка специфікації товарів
  const itemsCard = (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>{t("request.items")}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#12325c] ring-1 ring-blue-200">
              {detail.items.length}
            </span>
          </div>
        }
        description={t("request.itemsDesc")}
        className="px-3.5 sm:px-5 py-3 sm:py-3.5"
        actions={
          editable ? (
            <Link
              href={`/requests/${detail.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#12325c] ring-1 ring-blue-200 transition hover:bg-blue-100"
            >
              <span>✏️</span>
              <span>{t("request.editList")}</span>
            </Link>
          ) : null
        }
      />

      <div className="divide-y divide-slate-100">
        {detail.items.map((item, index) => {
          return (
            <div
              key={item.id}
              className="p-3.5 sm:p-5 transition hover:bg-slate-50/70"
            >
              {/* Рядок 1: Номер + Назва + Кількість (пігулка на мобільному) */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-[#12325c] text-xs font-bold text-white shadow-2xs mt-0.5">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug break-words">
                      {item.name}
                    </h3>
                  </div>
                </div>

                {/* Пігулка кількості (мобільний вигляд < sm) */}
                <div className="shrink-0 sm:hidden">
                  <div className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200/80 px-2.5 py-1 text-right shadow-2xs">
                    <span className="text-sm font-extrabold text-[#12325c] tracking-tight">
                      {formatQuantity(item.quantity)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase">
                      {item.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Контент: фото та метадані */}
              <div className="mt-2.5 sm:mt-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 sm:pl-9">
                {/* Фото або заглушка */}
                {item.images.length ? (
                  <div className="shrink-0 flex -space-x-1.5 overflow-hidden hover:space-x-1 transition-all">
                    {item.images.map((fileId) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        key={fileId}
                        href={`/api/files/${fileId}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group relative inline-block transition transform hover:scale-105 hover:z-20 active:scale-95"
                        title={t("item.viewPhoto")}
                      >
                        <img
                          src={`/api/files/${fileId}`}
                          alt=""
                          className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover ring-1 ring-slate-200 shadow-2xs group-hover:ring-blue-400"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}

                {/* Метадані позиції */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {item.nomenclatureId ? (
                      <Link
                        href={`/nomenclature/${item.nomenclatureId}`}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#12325c] ring-1 ring-blue-200/80 hover:bg-blue-100 hover:underline"
                        title={t("item.viewNomenclature")}
                      >
                        <span>⬡ {t("nom.card")} #{item.nomenclatureId}</span>
                      </Link>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t("item.newPositionShort")}
                      </span>
                    )}
                    {item.basCode ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs font-bold text-sky-800 ring-1 ring-sky-300">
                        <span>1C:</span>
                        <span>{item.basCode}</span>
                      </span>
                    ) : null}
                    {item.partNumber ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                        <span>{t("item.skuShort")}:</span>
                        <span>{item.partNumber}</span>
                      </span>
                    ) : null}
                    {item.manufacturer ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                        <span>🏭</span>
                        <span>{item.manufacturer}</span>
                      </span>
                    ) : null}
                  </div>

                  {item.comment ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-2 sm:p-2.5 text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-800">{t("common.comment")}: </span>
                      <span>{item.comment}</span>
                    </div>
                  ) : null}

                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#12325c] hover:underline max-w-full"
                    >
                      <span>🔗</span>
                      <span className="truncate">{item.url}</span>
                    </a>
                  ) : null}
                </div>

                {/* Блок кількості для десктопу (>= sm) */}
                <div className="hidden sm:block shrink-0 sm:self-center">
                  <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2 text-right shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t("item.quantity")}
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                      {formatQuantity(item.quantity)}{" "}
                      <span className="text-xs font-semibold text-slate-600 uppercase">
                        {item.unit}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  // 3. Картка історії подій
  const historyCard = (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>{t("request.history")}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
              {detail.events.length}
            </span>
          </div>
        }
        description={t("request.historyDesc")}
        className="px-3.5 sm:px-5 py-3 sm:py-3.5"
      />
      <ol className="divide-y divide-slate-100 p-2 sm:p-4">
        {detail.events.map((event) => (
          <li key={event.id} className="flex gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 text-xs">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] sm:text-[11px]">
              {initials(event.userName ?? t("audit.systemUser"))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-slate-800">{event.userName ?? t("audit.systemUser")}</span>
                <span className="text-slate-400 text-[11px]">· {formatDateTime(event.createdAt)}</span>
                {event.toStatus ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">➔</span>
                    <StatusBadge status={event.toStatus} />
                  </div>
                ) : (
                  <Badge tone="slate">{t(`event.${event.type}`)}</Badge>
                )}
              </div>
              {event.message ? (
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-xs sm:text-sm text-slate-800 border border-slate-100">
                  {event.message}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );

  // 4. Панель керування процесом заявки
  const workflowPanel = (
    <RequestWorkflowPanel
      requestId={detail.id}
      status={detail.status}
      transitions={transitions}
      canAssign={canAssign}
      assignees={assignees}
      assigneeId={detail.assigneeId}
      currentUserId={user.id}
      canComment
      isAuthor={detail.authorId === user.id}
      canSplit={actors.length > 0}
      items={detail.items.map((item) => ({ id: item.id, name: item.name }))}
      departments={departments}
      workshops={workshops}
      departmentId={detail.departmentId}
      workshopId={detail.workshopId}
      editable={editable}
    />
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Офіційні параметри для друку — компактна таблиця без зайвих рамок картки */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              {t("request.one")} № {detail.number}
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              {t("common.created")}: {formatDateTime(detail.createdAt)}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">{t("common.status")}: {t(`status.${detail.status}`)}</p>
            <p className="text-slate-600">{t("request.priority")}: {t(`priority.${detail.priority}`)}</p>
          </div>
        </div>
      </div>

      <div className="hidden print:block mb-4 text-xs border border-slate-300">
        <table className="w-full text-left">
          <tbody>
            <tr className="border-b border-slate-300">
              <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                {t("request.department")}:
              </th>
              <td className="p-2 w-1/4 border-r border-slate-300 font-medium text-slate-900">
                {localizedName(locale, { code: detail.departmentCode, nameRu: detail.departmentNameRu, nameUk: detail.departmentNameUk })}
              </td>
              <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                {t("request.workshop")}:
              </th>
              <td className="p-2 w-1/4 font-medium text-slate-900">
                {localizedName(locale, { code: detail.workshopCode, nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                {t("request.signRequester")}:
              </th>
              <td className="p-2 w-1/4 border-r border-slate-300 text-slate-900">
                {detail.authorName} ({detail.authorEmail})
              </td>
              <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                {t("request.assignee")}:
              </th>
              <td className="p-2 w-1/4 text-slate-900">
                {detail.assignee?.fullName ?? "—"}
              </td>
            </tr>
            {detail.comment ? (
              <tr>
                <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300 align-top">
                  {t("request.comment")}:
                </th>
                <td colSpan={3} className="p-2 text-slate-800 whitespace-pre-wrap">
                  {detail.comment}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="hidden print:block my-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
          {t("item.specifications")} ({detail.items.length}):
        </h2>
        <table className="w-full text-left text-xs border border-slate-400">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-400 text-slate-900">
              <th className="p-2 border-r border-slate-300 w-10 text-center">№</th>
              <th className="p-2 border-r border-slate-300">{t("item.name")}</th>
              <th className="p-2 border-r border-slate-300 w-36">{t("item.partNumber")} / 1C</th>
              <th className="p-2 border-r border-slate-300 w-32">{t("nom.manufacturer")}</th>
              <th className="p-2 border-r border-slate-300 w-24 text-right">{t("item.quantity")}</th>
              <th className="p-2 w-16 text-center">{t("item.unit")}</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item, index) => (
              <tr key={item.id} className="border-b border-slate-300 print-avoid-break">
                <td className="p-2 border-r border-slate-300 text-center font-mono">{index + 1}</td>
                <td className="p-2 border-r border-slate-300">
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  {item.comment ? (
                    <div className="mt-0.5 text-[11px] text-slate-500 italic leading-snug">
                      {t("common.comment")}: {item.comment}
                    </div>
                  ) : null}
                </td>
                <td className="p-2 border-r border-slate-300 font-mono text-slate-700">
                  {item.partNumber || item.basCode ? (
                    <>
                      {item.partNumber ?? ""}
                      {item.basCode ? ` (1C: ${item.basCode})` : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2 border-r border-slate-300 text-slate-700">{item.manufacturer || "—"}</td>
                <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-900">
                  {formatQuantity(item.quantity)}
                </td>
                <td className="p-2 text-center text-slate-800">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hidden print:block mt-8 pt-4 border-t border-slate-400 print-avoid-break">
        <div className="grid grid-cols-3 gap-8 text-xs text-slate-800">
          <div>
            <p className="font-bold">{t("request.signRequester")}:</p>
            <p className="mt-1 text-slate-700">{detail.authorName}</p>
            <div className="mt-10 border-b border-slate-400 w-full" />
            <p className="mt-1 text-[10px] text-slate-500">{t("request.signDate")}</p>
          </div>
          <div>
            <p className="font-bold">{t("request.signSupervisor")}:</p>
            <p className="mt-1 text-slate-700">
              {localizedName(locale, { code: detail.workshopCode, nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
            </p>
            <div className="mt-10 border-b border-slate-400 w-full" />
            <p className="mt-1 text-[10px] text-slate-500">{t("request.signDate")}</p>
          </div>
          <div>
            <p className="font-bold">{t("request.signBuyer")}:</p>
            <p className="mt-1 text-slate-700">
              {detail.assignee?.fullName ?? t("request.noAssignee")}
            </p>
            <div className="mt-10 border-b border-slate-400 w-full" />
            <p className="mt-1 text-[10px] text-slate-500">{t("request.signDate")}</p>
          </div>
        </div>
      </div>

      {/* Шапка заявки на екрані */}
      <div className="no-print print:hidden">
        {/* Кнопка повернення до списку на мобільних */}
        <div className="mb-2 flex items-center justify-between text-xs sm:hidden">
          <Link
            href="/requests"
            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 active:text-slate-900"
          >
            <span>←</span>
            <span>{t("nav.requests")}</span>
          </Link>
          <span className="font-mono text-[11px] text-slate-400">#{detail.number}</span>
        </div>

        <PageHeader
          title={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {t("request.one")} {detail.number}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={detail.status} />
                <PriorityBadge priority={detail.priority} />
              </div>
            </div>
          }
          description={`${t("common.author")}: ${detail.authorName} (${detail.authorEmail}) · ${formatDateTime(detail.createdAt)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <RefreshControl />
              <div className="hidden sm:inline-flex">
                <PrintButton />
              </div>
              {user.permissions.includes("requests.create") ? (
                <Link
                  href={`/requests/new?copyFrom=${detail.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 hover:text-indigo-900 shadow-2xs"
                  title={t("request.copyTitle", { number: detail.number })}
                >
                  <IconCopy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("request.copyAction")}</span>
                </Link>
              ) : null}
              {editable ? (
                <Link
                  href={`/requests/${detail.id}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
                >
                  <span>✎</span>
                  <span>{t("common.edit")}</span>
                </Link>
              ) : null}
            </div>
          }
        />
      </div>

      {/* Візуальний степпер життєвого циклу — приховується при друку */}
      <div className="no-print print:hidden">
        <RequestLifecycleStepper status={detail.status} />
      </div>

      {/* Банер запиту уточнення для автора */}
      {detail.status === "needs_info" ? (
        <div className="no-print print:hidden rounded-xl border border-amber-300 bg-amber-50 p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-base sm:text-lg">
                ⚠️
              </span>
              <div>
                <h2 className="text-sm font-bold text-amber-950">{t("request.needsInfoTitle")}</h2>
                <p className="mt-0.5 text-xs text-amber-900">
                  {detail.events.find((e) => e.toStatus === "needs_info")?.message
                    ? `«${detail.events.find((e) => e.toStatus === "needs_info")?.message}»`
                    : t("request.needsInfoFallback")}
                </p>
              </div>
            </div>
            {editable ? (
              <Link
                href={`/requests/${detail.id}/edit`}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
              >
                <span>✏️</span>
                <span>{t("request.editItems")}</span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Інтерактивний адаптивний макет на екрані (мобільні вкладки або десктопна сітка) */}
      <div className="no-print print:hidden">
        <RequestDetailLayout
          paramsCard={paramsCard}
          itemsCard={itemsCard}
          historyCard={historyCard}
          workflowPanel={workflowPanel}
          itemsCount={detail.items.length}
          actionsCount={transitions.length}
          eventsCount={detail.events.length}
        />
      </div>
    </div>
  );
}
