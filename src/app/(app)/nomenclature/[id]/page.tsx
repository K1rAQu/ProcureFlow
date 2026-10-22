import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { NomenclatureStatusBadge, StatusBadge } from "@/components/status";
import { MergePanel, NomenclatureEditor, NomenclatureRowActions } from "@/components/nomenclature-admin";
import { getNomenclatureCard } from "@/lib/nomenclature-service";
import { pageContext } from "@/lib/page";
import { formatDateTime, formatMoney, formatQuantity } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NomenclatureCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t } = await pageContext();
  if (!user.permissions.includes("nomenclature.view")) redirect("/");

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const card = await getNomenclatureCard(id);
  if (!card) notFound();

  const canEdit = user.permissions.includes("nomenclature.edit");
  const canMerge = user.permissions.includes("nomenclature.merge");

  return (
    <>
      <PageHeader
        title={card.name}
        description={`#${card.id} · ${t("nom.createdBy")}: ${card.createdByName ?? "—"} · ${formatDateTime(card.createdAt)}`}
        actions={
          <>
            <NomenclatureStatusBadge status={card.status} />
            <NomenclatureRowActions
              id={card.id}
              status={card.status}
              canArchive={user.permissions.includes("nomenclature.archive")}
              canApprove={user.permissions.includes("nomenclature.approve")}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title={t("nom.card")} />
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <div className="flex flex-wrap gap-2 sm:col-span-1">
                {card.images.length ? (
                  card.images.map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={image.fileId}
                      src={`/api/files/${image.fileId}`}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  ))
                ) : (
                  <span className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                    IMG
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:col-span-2">
                <div>
                  <dt className="text-xs text-slate-500">{t("item.partNumber")}</dt>
                  <dd className="font-medium text-slate-800">{card.partNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{t("nom.basCode")}</dt>
                  <dd className="font-medium text-slate-800">{card.basCode ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{t("nom.manufacturer")}</dt>
                  <dd className="font-medium text-slate-800">{card.manufacturer ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{t("nom.lastPrice")}</dt>
                  <dd className="font-medium text-slate-800">
                    {card.lastPrice ? formatMoney(card.lastPrice, card.lastCurrency) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{t("nom.usage")}</dt>
                  <dd className="font-medium text-slate-800">{card.usageCount}</dd>
                </div>
                {card.url ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">{t("item.url")}</dt>
                    <dd>
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-xs text-[#12325c] hover:underline"
                      >
                        {card.url}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {card.description ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">{t("nom.description")}</dt>
                    <dd className="whitespace-pre-wrap text-slate-700">{card.description}</dd>
                  </div>
                ) : null}
                {card.specs ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">{t("nom.specs")}</dt>
                    <dd className="whitespace-pre-wrap text-slate-700">{card.specs}</dd>
                  </div>
                ) : null}
                {card.mergedIntoId ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">{t("nom.status.merged")}</dt>
                    <dd>
                      <Link
                        href={`/nomenclature/${card.mergedIntoId}`}
                        className="text-xs text-[#12325c] hover:underline"
                      >
                        #{card.mergedIntoId}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("nom.usageHistory")} />
            {card.usage.length === 0 ? (
              <EmptyState title={t("request.none")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-2">{t("request.number")}</th>
                      <th className="px-4 py-2">{t("common.status")}</th>
                      <th className="px-4 py-2">{t("item.quantity")}</th>
                      <th className="px-4 py-2">{t("item.price")}</th>
                      <th className="px-4 py-2">{t("common.author")}</th>
                      <th className="px-4 py-2">{t("common.created")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {card.usage.map((usage) => (
                      <tr key={usage.itemId}>
                        <td className="px-4 py-2">
                          <Link
                            href={`/requests/${usage.requestId}`}
                            className="font-medium text-[#12325c] hover:underline"
                          >
                            {usage.number}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={usage.status} />
                        </td>
                        <td className="px-4 py-2 text-slate-600">{formatQuantity(usage.quantity)}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {usage.unitPrice ? formatMoney(usage.unitPrice, usage.currency) : "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{usage.authorName ?? "—"}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(usage.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={t("nom.changeHistory")} />
            <ol className="divide-y divide-slate-100">
              {card.history.map((entry) => (
                <li key={entry.id} className="px-4 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-700">{entry.action}</span>
                    <span className="text-slate-400">
                      {entry.userName ?? "—"} · {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  {entry.note ? <p className="text-slate-500">{entry.note}</p> : null}
                  {entry.changes ? (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                      {Object.entries(entry.changes).map(([field, change]) => (
                        <li key={field}>
                          <span className="font-medium">{field}</span>: {String(change.from ?? "—")} →{" "}
                          {String(change.to ?? "—")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          {canEdit ? (
            <NomenclatureEditor
              id={card.id}
              initial={{
                name: card.name,
                partNumber: card.partNumber ?? "",
                basCode: card.basCode ?? "",
                manufacturer: card.manufacturer ?? "",
                url: card.url ?? "",
                description: card.description ?? "",
                specs: card.specs ?? "",
                unit: card.unit,
                lastPrice: card.lastPrice ? String(Number(card.lastPrice)) : "",
                lastCurrency: card.lastCurrency ?? "UAH",
              }}
              images={card.images.map((image) => ({ id: image.fileId, url: `/api/files/${image.fileId}` }))}
            />
          ) : null}
          {canMerge ? <MergePanel currentId={card.id} /> : null}
        </div>
      </div>
    </>
  );
}
