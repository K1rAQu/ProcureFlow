import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { HttpError, hashPassword, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { userCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("admin.users");
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        roleId: users.roleId,
        roleCode: roles.code,
        isActive: users.isActive,
        workshopId: users.workshopId,
        departmentId: users.departmentId,
        locale: users.locale,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .orderBy(asc(users.fullName));
    return jsonOk({ items: rows });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.users");
    const payload = userCreateSchema.parse(await readJson(request));

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, payload.email)).limit(1);
    if (existing) throw new HttpError(409, "email_taken");

    const [role] = await db.select().from(roles).where(eq(roles.id, payload.roleId)).limit(1);
    if (!role) throw new HttpError(400, "invalid_role");

    const [created] = await db
      .insert(users)
      .values({
        email: payload.email,
        fullName: payload.fullName,
        passwordHash: payload.password ? await hashPassword(payload.password) : null,
        roleId: payload.roleId,
        workshopId: payload.workshopId ?? null,
        departmentId: payload.departmentId ?? null,
        locale: payload.locale,
        isActive: payload.isActive,
      })
      .returning({ id: users.id });

    await writeAudit({
      userId: admin.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      summary: `${payload.fullName} <${payload.email}>, роль ${role.code}`,
    });
    return jsonOk({ id: created.id }, 201);
  });
}
