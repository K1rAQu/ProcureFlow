import { eq } from "drizzle-orm";
import { db } from "@/db";
import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { resolveTable } from "@/lib/directories";
import { directoryUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.directories");
    const { kind, id: rawId } = await context.params;
    const table = resolveTable(kind);
    const id = parseIdParam(rawId);
    const payload = directoryUpdateSchema.parse(await readJson(request));

    const [current] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!current) throw new HttpError(404, "not_found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.name !== undefined) {
      patch.nameRu = payload.name;
      patch.nameUk = payload.name;
    }
    if (payload.nameRu !== undefined) patch.nameRu = payload.nameRu;
    if (payload.nameUk !== undefined) patch.nameUk = payload.nameUk;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.isActive !== undefined) patch.isActive = payload.isActive;
    if (payload.sortOrder !== undefined) patch.sortOrder = payload.sortOrder;

    await db.update(table).set(patch).where(eq(table.id, id));
    await writeAudit({
      userId: admin.id,
      action: `${kind}.update`,
      entityType: kind,
      entityId: id,
      summary: current.code,
      payload: patch,
    });
    return jsonOk({ ok: true });
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.directories");
    const { kind, id: rawId } = await context.params;
    const table = resolveTable(kind);
    const id = parseIdParam(rawId);

    const [current] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!current) throw new HttpError(404, "not_found");

    try {
      await db.delete(table).where(eq(table.id, id));
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === "23503") {
        throw new HttpError(
          409,
          "Запис використовується у системі і не може бути видалений. Ви можете деактивувати його.",
        );
      }
      throw err;
    }

    await writeAudit({
      userId: admin.id,
      action: `${kind}.delete`,
      entityType: kind,
      entityId: id,
      summary: `Видалено: ${current.code} (${current.nameUk || current.nameRu})`,
    });

    return jsonOk({ ok: true });
  });
}
