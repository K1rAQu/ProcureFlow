import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assignRequest } from "@/lib/requests-service";
import { assignSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const payload = assignSchema.parse(await readJson(request));
    await assignRequest(id, payload.assigneeId, user);
    return jsonOk({ ok: true });
  });
}
