import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { isValidPermission } from "@/lib/permissions";
import { roleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("admin.roles");
    const rows = await db.select().from(roles).orderBy(asc(roles.id));
    return jsonOk({ items: rows });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.roles");
    const payload = roleSchema.parse(await readJson(request));
    const permissions = payload.permissions.filter(isValidPermission);

    const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, payload.code)).limit(1);
    if (existing) throw new HttpError(409, "code_taken");

    const [created] = await db
      .insert(roles)
      .values({
        code: payload.code,
        nameRu: payload.nameRu,
        nameUk: payload.nameUk,
        permissions,
        isSystem: false,
      })
      .returning({ id: roles.id });

    await writeAudit({
      userId: admin.id,
      action: "role.create",
      entityType: "role",
      entityId: created.id,
      summary: payload.code,
      payload: { permissions },
    });
    return jsonOk({ id: created.id }, 201);
  });
}
