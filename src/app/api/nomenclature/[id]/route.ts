import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { assertOwnedFiles } from "@/lib/files";
import { getNomenclatureCard, updateNomenclature } from "@/lib/nomenclature-service";
import { nomenclatureUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requirePermission("nomenclature.view");
    const id = parseIdParam((await context.params).id);
    const card = await getNomenclatureCard(id);
    if (!card) throw new HttpError(404, "not_found");
    return jsonOk(card);
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requirePermission("nomenclature.edit");
    const id = parseIdParam((await context.params).id);
    const payload = nomenclatureUpdateSchema.parse(await readJson(request));

    if (payload.status && payload.status === "archived") {
      await requirePermission("nomenclature.archive");
    }
    if (payload.fileIds) await assertOwnedFiles(payload.fileIds, user);

    await updateNomenclature(id, payload, user);
    return jsonOk({ ok: true });
  });
}
