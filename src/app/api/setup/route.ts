import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { HttpError, createSession, hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { countUsers, ensureCoreData } from "@/lib/bootstrap";
import { setupSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const total = await countUsers();
    return jsonOk({ initialized: total > 0 });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const total = await countUsers();
    if (total > 0) throw new HttpError(409, "already_initialized");

    const payload = setupSchema.parse(await readJson(request));
    await ensureCoreData();

    const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
    if (!adminRole) throw new HttpError(500, "roles_missing");

    const [created] = await db
      .insert(users)
      .values({
        email: payload.email,
        fullName: payload.fullName,
        passwordHash: await hashPassword(payload.password),
        roleId: adminRole.id,
        locale: "uk",
        isActive: true,
      })
      .returning({ id: users.id });

    await writeAudit({
      userId: created.id,
      action: "system.setup",
      entityType: "user",
      entityId: created.id,
      summary: `Створено першого адміністратора ${payload.email}`,
    });
    await createSession(created.id);
    return jsonOk({ ok: true, userId: created.id }, 201);
  });
}
