import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertOwnedFiles } from "@/lib/files";
import { createNomenclature, findDuplicateCandidates, searchNomenclature } from "@/lib/nomenclature-service";
import { getSettings } from "@/lib/settings";
import { nomenclatureCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("nomenclature.view");
    const url = new URL(request.url);
    const mineOnly = url.searchParams.get("mine") === "1";
    const result = await searchNomenclature({
      query: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 20),
      offset: Number(url.searchParams.get("offset") ?? 0),
      sort: (url.searchParams.get("sort") as "name" | "updated" | "usage" | null) ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") === "1",
      myUserId: mineOnly ? user.id : undefined,
    });
    return jsonOk(result);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("nomenclature.create");
    const payload = nomenclatureCreateSchema.parse(await readJson(request));
    await assertOwnedFiles(payload.fileIds ?? [], user);

    const duplicates = await findDuplicateCandidates({
      name: payload.name,
      partNumber: payload.partNumber,
      basCode: payload.basCode,
    });
    if (duplicates.length && !payload.confirmDuplicate) {
      return jsonOk({ duplicates, created: null }, 409);
    }

    const settings = await getSettings();
    const forcePending = duplicates.length > 0 && !user.permissions.includes("nomenclature.approve");
    const created = await createNomenclature(payload, user, {
      autoApprove: settings.autoApproveNomenclature,
      forcePending,
    });
    return jsonOk({ created, duplicates: [] }, 201);
  });
}
