import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { roles, sessions, users } from "@/db/schema";
import { handleRoute, jsonOk, parseIdParam, readJson } from "@/lib/api";
import { HttpError, hashPassword, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { userUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.users");
    const id = parseIdParam((await context.params).id);
    const payload = userUpdateSchema.parse(await readJson(request));

    const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!current) throw new HttpError(404, "not_found");

    // Нельзя лишить систему последнего администратора
    if ((payload.roleId && payload.roleId !== current.roleId) || payload.isActive === false) {
      const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
      if (adminRole && current.roleId === adminRole.id) {
        const [{ value: activeAdmins } = { value: 0 }] = await db
          .select({ value: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.roleId, adminRole.id), eq(users.isActive, true)));
        if (activeAdmins <= 1) throw new HttpError(409, "last_admin");
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.fullName !== undefined) patch.fullName = payload.fullName;
    if (payload.roleId !== undefined) patch.roleId = payload.roleId;
    if (payload.workshopId !== undefined) patch.workshopId = payload.workshopId;
    if (payload.departmentId !== undefined) patch.departmentId = payload.departmentId;
    if (payload.locale !== undefined) patch.locale = payload.locale;
    if (payload.isActive !== undefined) patch.isActive = payload.isActive;
    if (payload.password) patch.passwordHash = await hashPassword(payload.password);

    await db.update(users).set(patch).where(eq(users.id, id));

    // Смена пароля или блокировка завершает активные сессии пользователя
    if (payload.password || payload.isActive === false) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    await writeAudit({
      userId: admin.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      summary: current.email,
      payload: { ...payload, password: payload.password ? "changed" : undefined },
    });
    return jsonOk({ ok: true });
  });
}
