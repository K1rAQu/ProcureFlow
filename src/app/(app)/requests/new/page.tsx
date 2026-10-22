import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/request-form";
import { localizedName } from "@/lib/i18n";
import { loadDirectories, pageContext, readNumberParam } from "@/lib/page";
import { getRequestDetail } from "@/lib/requests-service";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, locale, t } = await pageContext();
  if (!user.permissions.includes("requests.create")) redirect("/");

  const params = (await searchParams) ?? {};
  const copyFromId = readNumberParam(params, "copyFrom");

  let copySource = null;
  if (copyFromId && copyFromId > 0) {
    try {
      copySource = await getRequestDetail(copyFromId, user);
    } catch {
      // Ігноруємо, якщо ID недійсний або немає доступу
    }
  }

  const { departments, workshops, units } = await loadDirectories();
  const settings = await getSettings();

  const defaultUnit = locale === "en" ? "pcs" : "шт";

  const initialItems = copySource?.items?.length
    ? copySource.items.map((item, idx) => ({
        key: `copy-${item.id}-${idx}`,
        nomenclatureId: item.nomenclatureId,
        name: item.name,
        partNumber: item.partNumber ?? "",
        manufacturer: item.manufacturer ?? "",
        quantity: String(Number(item.quantity) || 1),
        unit: item.unit || defaultUnit,
        url: item.url ?? "",
        comment: item.comment ?? "",
        images: item.images.map((fileId) => ({ id: fileId, url: `/api/files/${fileId}`, name: "" })),
        updateNomenclatureCard: false,
        confirmNewNomenclature: false,
      }))
    : undefined;

  return (
    <>
      <PageHeader
        title={copySource ? t("request.copyTitle", { number: copySource.number }) : t("request.new")}
        description={
          copySource
            ? t("request.copyDesc", { number: copySource.number })
            : t("request.rules")
        }
      />
      <RequestForm
        requiredFields={settings.requiredItemFields}
        departments={departments.map((item) => ({ id: item.id, nameRu: item.nameRu, nameUk: item.nameUk, code: item.code }))}
        workshops={workshops.map((item) => ({ id: item.id, nameRu: item.nameRu, nameUk: item.nameUk, code: item.code }))}
        units={units.map((item) => ({ id: item.id, name: localizedName(locale, item), description: item.description, code: item.code }))}
        copiedFromNumber={copySource?.number}
        initial={{
          departmentId: copySource ? copySource.departmentId : (user.departmentId ?? null),
          workshopId: copySource ? copySource.workshopId : (user.workshopId ?? null),
          priority: copySource ? copySource.priority : "normal",
          comment: copySource ? copySource.comment : null,
          items: initialItems,
        }}
      />
    </>
  );
}
