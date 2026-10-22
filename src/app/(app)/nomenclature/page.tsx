import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { NomenclatureFilters } from "@/components/nomenclature-filters";
import { NomenclatureStatusBadge } from "@/components/status";
import { NewNomenclatureButton, NomenclatureRowActions } from "@/components/nomenclature-admin";
import { ExportCsvButton } from "@/components/export-button";
import { searchNomenclature } from "@/lib/nomenclature-service";
import { pageContext, readNumberParam, readParam } from "@/lib/page";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NomenclaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, t } = await pageContext();
  if (!user.permissions.includes("nomenclature.view")) redirect("/");

  const params = await searchParams;
  const page = readNumberParam(params, "page") ?? 1;
  const pageSize = 20;
  const status = readParam(params, "status") ?? "all_active";
  const isMine = readParam(params, "mine") === "1";

  const result = await searchNomenclature({
    query: readParam(params, "q"),
    status: status === "all_active" ? undefined : status,
    sort: (readParam(params, "sort") as "name" | "updated" | "usage" | undefined) ?? "updated",
    limit: pageSize,
    offset: (page - 1) * pageSize,
    includeArchived: status === "all",
    myUserId: isMine ? user.id : undefined,
  });

  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  const canCreate = user.permissions.includes("nomenclature.create");
  const canArchive = user.permissions.includes("nomenclature.archive");
  const canApprove = user.permissions.includes("nomenclature.approve");

  return (
    <>
      <PageHeader
        title={t("nom.title")}
        description={`${t("common.total")}: ${result.total}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton endpoint="/api/export/nomenclature" />
            {canCreate ? <NewNomenclatureButton /> : null}
          </div>
        }
      />

      <div className="mb-4">
        <NomenclatureFilters
          action="/nomenclature"
          values={{
            q: readParam(params, "q"),
            status,
            mine: readParam(params, "mine"),
            sort: readParam(params, "sort"),
          }}
        />
      </div>

      <Card>
        {result.items.length === 0 ? (
          <EmptyState title={t("nom.noneFound")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t("item.name")}</th>
                  <th className="hidden px-4 py-2 sm:table-cell">{t("item.partNumber")} / {t("nom.basCode")}</th>
                  <th className="hidden px-4 py-2 md:table-cell">{t("nom.lastPrice")}</th>
                  <th className="hidden px-4 py-2 lg:table-cell">{t("nom.usage")}</th>
                  <th className="px-4 py-2">{t("common.status")}</th>
                  <th className="hidden px-4 py-2 lg:table-cell">{t("common.updated")}</th>
                  <th className="px-4 py-2 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {item.imageId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/files/${item.imageId}`}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-400">
                            IMG
                          </span>
                        )}
                        <Link
                          href={`/nomenclature/${item.id}`}
                          className="font-medium text-[#12325c] hover:underline"
                        >
                          {item.name}
                        </Link>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 sm:table-cell">
                      <div>{item.partNumber ?? "—"}</div>
                      {item.basCode ? (
                        <div className="text-[11px] font-mono text-slate-400">
                          {t("nom.basCode")}: {item.basCode}
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 md:table-cell">
                      {item.lastPrice ? formatMoney(item.lastPrice, item.lastCurrency) : "—"}
                    </td>
                    <td className="hidden px-4 py-2 text-slate-600 lg:table-cell">{item.usageCount}</td>
                    <td className="px-4 py-2">
                      <NomenclatureStatusBadge status={item.status} />
                    </td>
                    <td className="hidden px-4 py-2 text-xs text-slate-500 lg:table-cell">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <NomenclatureRowActions
                        id={item.id}
                        status={item.status}
                        canArchive={canArchive}
                        canApprove={canApprove}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center gap-1">
          {Array.from({ length: pages }, (_, index) => index + 1).map((item) => {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              if (typeof value === "string" && key !== "page") query.set(key, value);
            }
            query.set("page", String(item));
            return (
              <Link
                key={item}
                href={`/nomenclature?${query.toString()}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-slate-200 ${
                  item === page ? "bg-[#12325c] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
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
