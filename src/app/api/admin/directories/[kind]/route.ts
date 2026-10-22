import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { resolveTable } from "@/lib/directories";
import { directorySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  return handleRoute(async () => {
    await requirePermission("admin.directories");
    const table = resolveTable((await context.params).kind);
    const rows = await db.select().from(table).orderBy(asc(table.sortOrder), asc(table.id));
    return jsonOk({ items: rows });
  });
}

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.directories");
    const kind = (await context.params).kind;
    const table = resolveTable(kind);
    const payload = directorySchema.parse(await readJson(request));

    const [existing] = await db.select({ id: table.id }).from(table).where(eq(table.code, payload.code)).limit(1);
    if (existing) throw new HttpError(409, "code_taken");

    const [created] = await db
      .insert(table)
      .values({
        code: payload.code,
        nameRu: payload.nameRu,
        nameUk: payload.nameUk,
        description: payload.description ?? null,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
      })
      .returning({ id: table.id });

    await writeAudit({
      userId: admin.id,
      action: `${kind}.create`,
      entityType: kind,
      entityId: created.id,
      summary: `${payload.code} — ${payload.nameUk || payload.nameRu}`,
    });
    return jsonOk({ id: created.id }, 201);
  });
}
