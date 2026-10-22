import { z } from "zod";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { findDuplicateCandidates } from "@/lib/nomenclature-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(300),
  partNumber: z.string().trim().max(160).nullable().optional(),
  basCode: z.string().trim().max(120).nullable().optional(),
  excludeId: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requirePermission("nomenclature.view");
    const payload = schema.parse(await readJson(request));
    const duplicates = await findDuplicateCandidates(payload);
    return jsonOk({ duplicates });
  });
}
