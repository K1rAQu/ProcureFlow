import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { assertOwnedFiles } from "@/lib/files";
import { getRequestDetail, updateRequest } from "@/lib/requests-service";
import { requestPayloadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const detail = await getRequestDetail(id, user);
    if (!detail) throw new HttpError(404, "not_found");
    return jsonOk(detail);
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const payload = requestPayloadSchema.parse(await readJson(request));
    await assertOwnedFiles(
      payload.items.flatMap((item) => item.fileIds ?? []),
      user,
    );
    const updated = await updateRequest(id, payload, user);
    return jsonOk(updated);
  });
}
