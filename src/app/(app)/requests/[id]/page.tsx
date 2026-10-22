import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PriorityBadge, StatusBadge } from "@/components/status";
import { RequestLifecycleStepper } from "@/components/request-stepper";
import { RequestWorkflowPanel } from "@/components/request-workflow";
import { AutoRefresher } from "@/components/auto-refresher";
import { PrintButton } from "@/components/print-button";
import { IconCheck, IconClock, IconCopy, IconMessageSquare, IconPrinter, IconUser } from "@/components/icons";
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

  return (
    <div className="space-y-6">
      <AutoRefresher intervalSeconds={15} />

      {/* Офіційна шапка документа — відображається ТІЛЬКИ при друку */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              Заявка на закупівлю № {detail.number}
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Дата створення: {formatDateTime(detail.createdAt)}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-900">Статус: {t(`status.${detail.status}`)}</p>
            <p className="text-slate-600">Пріоритет: {t(`priority.${detail.priority}`)}</p>
          </div>
        </div>
      </div>

      {/* Шапка заявки на екрані */}
      <div className="no-print print:hidden">
        <PageHeader
          title={
            <div className="flex flex-wrap items-center gap-3">
              <span>{t("request.one")} {detail.number}</span>
              <StatusBadge status={detail.status} />
              <PriorityBadge priority={detail.priority} />
            </div>
          }
          description={`Створено: ${detail.authorName} (${detail.authorEmail}) · ${formatDateTime(detail.createdAt)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton />
              {user.permissions.includes("requests.create") ? (
                <Link
                  href={`/requests/new?copyFrom=${detail.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 hover:text-indigo-900 shadow-2xs"
                  title="Створити нову заявку на основі поточної"
                >
                  <IconCopy className="h-3.5 w-3.5" /> Створити на основі
                </Link>
              ) : null}
              {editable ? (
                <Link
                  href={`/requests/${detail.id}/edit`}
                  className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
                >
                  ✎ {t("common.edit")}
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
        <div className="no-print print:hidden rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-lg">
                ⚠️
              </span>
              <div>
                <h2 className="text-sm font-bold text-amber-950">Запит уточнення за заявкою</h2>
                <p className="mt-0.5 text-xs text-amber-900">
                  {detail.events.find((e) => e.toStatus === "needs_info")?.message
                    ? `«${detail.events.find((e) => e.toStatus === "needs_info")?.message}»`
                    : "Відділ постачання очікує додаткову інформацію або коригування складу замовлення."}
                </p>
              </div>
            </div>
            {editable ? (
              <Link
                href={`/requests/${detail.id}/edit`}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
              >
                ✏️ Редагувати позиції заявки
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3 print:block print:space-y-4">
        {/* Ліва частина: Деталі, Специфікація товарів, Історія */}
        <div className="space-y-6 lg:col-span-2 print:space-y-4 print:w-full">
          {/* Офіційні параметри для друку — компактна таблиця без зайвих рамок картки */}
          <div className="hidden print:block mb-4 text-xs border border-slate-300">
            <table className="w-full text-left">
              <tbody>
                <tr className="border-b border-slate-300">
                  <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                    {t("request.department")}:
                  </th>
                  <td className="p-2 w-1/4 border-r border-slate-300 font-medium text-slate-900">
                    {localizedName(locale, { nameRu: detail.departmentNameRu, nameUk: detail.departmentNameUk })}
                  </td>
                  <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                    {t("request.workshop")}:
                  </th>
                  <td className="p-2 w-1/4 font-medium text-slate-900">
                    {localizedName(locale, { nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <th className="p-2 w-1/4 bg-slate-50 font-semibold text-slate-700 border-r border-slate-300">
                    Замовник (автор):
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

          {/* Картка параметрів на екрані */}
          <div className="no-print print:hidden">
            <Card>
              <CardHeader title="Інформація про заявку" />
              <dl className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t("request.department")}</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {localizedName(locale, { nameRu: detail.departmentNameRu, nameUk: detail.departmentNameUk })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t("request.workshop")}</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {localizedName(locale, { nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t("request.assignee")}</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {detail.assignee ? (
                      <span className="inline-flex items-center gap-1.5 text-indigo-950">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                          {initials(detail.assignee.fullName)}
                        </span>
                        {detail.assignee.fullName}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">{t("request.noAssignee")}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">{t("common.updated")}</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{formatDateTime(detail.updatedAt)}</dd>
                </div>
                {detail.parent ? (
                  <div>
                    <dt className="text-xs font-medium text-slate-500">{t("request.parent")}</dt>
                    <dd className="mt-1">
                      <Link href={`/requests/${detail.parent.id}`} className="font-semibold text-[#12325c] hover:underline">
                        {detail.parent.number}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {detail.children.length ? (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-xs font-medium text-slate-500">{t("request.children")}</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
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
                    <dt className="text-xs font-medium text-slate-500">{t("request.comment")}</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">
                      {detail.comment}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </div>

          {/* Таблиця номенклатур для друку — чиста таблиця на всю ширину БЕЗ зайвих рамок картки та відступів */}
          <div className="hidden print:block my-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
              Специфікація товарів та матеріалів ({detail.items.length}):
            </h2>
            <table className="w-full text-left text-xs border border-slate-400">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-slate-400 text-slate-900">
                  <th className="p-2 border-r border-slate-300 w-10 text-center">№</th>
                  <th className="p-2 border-r border-slate-300">Найменування та примітки</th>
                  <th className="p-2 border-r border-slate-300 w-36">Артикул / 1С</th>
                  <th className="p-2 border-r border-slate-300 w-32">Виробник</th>
                  <th className="p-2 border-r border-slate-300 w-24 text-right">Кількість</th>
                  <th className="p-2 w-16 text-center">Од. вим.</th>
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
                          Примітка: {item.comment}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2 border-r border-slate-300 font-mono text-slate-700">
                      {item.partNumber || item.basCode ? (
                        <>
                          {item.partNumber ?? ""}
                          {item.basCode ? ` (1С: ${item.basCode})` : ""}
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

          {/* Специфікація позицій на екрані — зручна та красива */}
          <div className="no-print print:hidden">
            <Card>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <span>Специфікація позицій</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#12325c] ring-1 ring-blue-200">
                      {detail.items.length}
                    </span>
                  </div>
                }
                description="Перелік замовлених товарів, матеріалів та послуг з реквізитами та кодами"
                actions={
                  editable ? (
                    <Link
                      href={`/requests/${detail.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#12325c] ring-1 ring-blue-200 transition hover:bg-blue-100"
                    >
                      <span>✏️</span>
                      <span>Редагувати список</span>
                    </Link>
                  ) : null
                }
              />

              <div className="divide-y divide-slate-100">
                {detail.items.map((item, index) => {
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start transition hover:bg-slate-50/70"
                    >
                      {/* Ліва частина: Номер + Фото */}
                      <div className="flex items-start gap-3 shrink-0">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#12325c] text-xs font-bold text-white shadow-2xs">
                          #{index + 1}
                        </span>
                        {item.images.length ? (
                          <div className="flex -space-x-2 overflow-hidden hover:space-x-1 transition-all">
                            {item.images.map((fileId) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a
                                key={fileId}
                                href={`/api/files/${fileId}`}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="group relative inline-block transition transform hover:scale-105 hover:z-20"
                                title="Відкрити повне фото"
                              >
                                <img
                                  src={`/api/files/${fileId}`}
                                  alt=""
                                  className="h-14 w-14 rounded-xl object-cover ring-2 ring-white shadow-xs group-hover:ring-blue-400"
                                />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-semibold text-slate-400 ring-1 ring-slate-200/80">
                            Без фото
                          </span>
                        )}
                      </div>

                      {/* Центральна частина: Інформація про позицію */}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 leading-snug">
                            {item.name}
                          </h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {item.nomenclatureId ? (
                              <Link
                                href={`/nomenclature/${item.nomenclatureId}`}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#12325c] ring-1 ring-blue-200/80 hover:bg-blue-100 hover:underline"
                                title="Переглянути картку в довіднику номенклатури"
                              >
                                <span>⬡ Номенклатура №{item.nomenclatureId}</span>
                              </Link>
                            ) : (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                Нова позиція
                              </span>
                            )}
                            {item.basCode ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs font-bold text-sky-800 ring-1 ring-sky-300">
                                <span>1С:</span>
                                <span>{item.basCode}</span>
                              </span>
                            ) : null}
                            {item.partNumber ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
                                <span>арт:</span>
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
                        </div>

                        {item.comment ? (
                          <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-2.5 text-xs text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-800">Примітка: </span>
                            <span>{item.comment}</span>
                          </div>
                        ) : null}

                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#12325c] hover:underline"
                          >
                            <span>🔗</span>
                            <span className="truncate max-w-md">{item.url}</span>
                          </a>
                        ) : null}
                      </div>

                      {/* Права частина: Кількість у виділеному блоці */}
                      <div className="shrink-0 sm:self-center">
                        <div className="flex flex-col items-end justify-center rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2 text-right shadow-2xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Кількість
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
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Блок підписів — відображається ТІЛЬКИ при друку */}
          <div className="hidden print:block mt-8 pt-4 border-t border-slate-400 print-avoid-break">
            <div className="grid grid-cols-3 gap-8 text-xs text-slate-800">
              <div>
                <p className="font-bold">Замовник (автор):</p>
                <p className="mt-1 text-slate-700">{detail.authorName}</p>
                <div className="mt-10 border-b border-slate-400 w-full" />
                <p className="mt-1 text-[10px] text-slate-500">(підпис, дата)</p>
              </div>
              <div>
                <p className="font-bold">Керівник цеху / напряму:</p>
                <p className="mt-1 text-slate-700">
                  {localizedName(locale, { nameRu: detail.workshopNameRu, nameUk: detail.workshopNameUk })}
                </p>
                <div className="mt-10 border-b border-slate-400 w-full" />
                <p className="mt-1 text-[10px] text-slate-500">(підпис, дата)</p>
              </div>
              <div>
                <p className="font-bold">Відділ закупівель:</p>
                <p className="mt-1 text-slate-700">
                  {detail.assignee?.fullName ?? "Відповідальний за закупівлю"}
                </p>
                <div className="mt-10 border-b border-slate-400 w-full" />
                <p className="mt-1 text-[10px] text-slate-500">(підпис, дата)</p>
              </div>
            </div>
          </div>

          {/* Історія подій та коментарів — приховується при друку */}
          <div className="no-print print:hidden">
            <Card>
              <CardHeader title="Хронологія подій та коментарі" description="Повний аудит дій за заявкою" />
              <ol className="divide-y divide-slate-100 p-2 sm:p-4">
                {detail.events.map((event) => (
                  <li key={event.id} className="flex gap-3.5 p-3 text-xs">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {initials(event.userName ?? "Система")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800">{event.userName ?? "Система"}</span>
                        <span className="text-slate-400">· {formatDateTime(event.createdAt)}</span>
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
                        <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-sm text-slate-800 border border-slate-100">
                          {event.message}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>

        {/* Права частина: Панель керування статусом та діями — приховується при друку */}
        <div className="no-print print:hidden space-y-4">
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
        </div>
      </div>
    </div>
  );
}
