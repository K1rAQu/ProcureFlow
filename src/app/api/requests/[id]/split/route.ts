import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { splitRequest } from "@/lib/requests-service";
import { splitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const payload = splitSchema.parse(await readJson(request));
    const created = await splitRequest(id, payload.itemIds, payload.departmentId, payload.workshopId, user);
    return jsonOk(created, 201);
  });
}
