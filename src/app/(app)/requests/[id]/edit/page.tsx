import { notFound, redirect } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/request-form";
import { HttpError } from "@/lib/auth";
import { loadDirectories, pageContext } from "@/lib/page";
import { getRequestDetail } from "@/lib/requests-service";
import { getSettings } from "@/lib/settings";
import { canEditRequest, type RequestStatus } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, t } = await pageContext();
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
    throw error;
  }
  if (!detail) notFound();

  const settings = await getSettings();
  const editable = canEditRequest({
    status: detail.status as RequestStatus,
    isAuthor: detail.authorId === user.id,
    permissions: user.permissions,
    editableStatuses: settings.editableStatuses,
  });
  if (!editable) redirect(`/requests/${id}`);

  const { departments, workshops, units } = await loadDirectories();

  return (
    <>
      <PageHeader title={`${t("request.edit")} ${detail.number}`} description={t("request.rules")} />
      <RequestForm
        mode="edit"
        requiredFields={settings.requiredItemFields}
        departments={departments.map((item) => ({ id: item.id, nameRu: item.nameRu, nameUk: item.nameUk }))}
        workshops={workshops.map((item) => ({ id: item.id, nameRu: item.nameRu, nameUk: item.nameUk }))}
        units={units.map((item) => ({ id: item.id, name: item.nameUk || item.nameRu, description: item.description }))}
        initial={{
          id: detail.id,
          departmentId: detail.departmentId,
          workshopId: detail.workshopId,
          priority: detail.priority,
          comment: detail.comment,
          items: detail.items.map((item) => ({
            key: `item-${item.id}`,
            nomenclatureId: item.nomenclatureId,
            name: item.name,
            partNumber: item.partNumber ?? "",
            manufacturer: item.manufacturer ?? "",
            quantity: String(Number(item.quantity)),
            unit: item.unit,
            url: item.url ?? "",
            comment: item.comment ?? "",
            images: item.images.map((fileId) => ({ id: fileId, url: `/api/files/${fileId}`, name: "" })),
            updateNomenclatureCard: false,
            confirmNewNomenclature: false,
          })),
        }}
      />
    </>
  );
}
