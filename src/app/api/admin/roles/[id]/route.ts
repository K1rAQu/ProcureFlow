import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { isValidPermission } from "@/lib/permissions";
import { roleUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.roles");
    const id = parseIdParam((await context.params).id);
    const payload = roleUpdateSchema.parse(await readJson(request));

    const [current] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!current) throw new HttpError(404, "not_found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.name !== undefined) {
      patch.nameRu = payload.name;
      patch.nameUk = payload.name;
    }
    if (payload.nameRu !== undefined) patch.nameRu = payload.nameRu;
    if (payload.nameUk !== undefined) patch.nameUk = payload.nameUk;
    if (payload.permissions !== undefined) {
      if (current.code === "admin") throw new HttpError(409, "system_role_locked");
      patch.permissions = payload.permissions.filter(isValidPermission);
    }

    await db.update(roles).set(patch).where(eq(roles.id, id));
    await writeAudit({
      userId: admin.id,
      action: "role.update",
      entityType: "role",
      entityId: id,
      summary: current.code,
      payload: patch,
    });
    return jsonOk({ ok: true });
  });
}
