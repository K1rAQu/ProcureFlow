import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addRequestComment } from "@/lib/requests-service";
import { commentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const id = parseIdParam((await context.params).id);
    const payload = commentSchema.parse(await readJson(request));
    await addRequestComment(id, payload.message, payload.type, user);
    return jsonOk({ ok: true });
  });
}
