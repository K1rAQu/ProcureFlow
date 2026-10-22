import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { changeRequestStatus } from "@/lib/requests-service";
import { statusChangeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const payload = statusChangeSchema.parse(await readJson(request));
    await changeRequestStatus(id, payload.status, payload.comment ?? null, user);
    return jsonOk({ ok: true, status: payload.status });
  });
}
