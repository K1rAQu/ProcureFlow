import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { mergeNomenclature } from "@/lib/nomenclature-service";
import { mergeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("nomenclature.merge");
    const payload = mergeSchema.parse(await readJson(request));
    await mergeNomenclature(payload.sourceId, payload.targetId, user);
    return jsonOk({ ok: true });
  });
}
