import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { HttpError, createSession, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const payload = loginSchema.parse(await readJson(request));

    const [user] = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);
    if (!user || !user.passwordHash) throw new HttpError(401, "invalid_credentials");

    const valid = await verifyPassword(payload.password, user.passwordHash);
    if (!valid) {
      await writeAudit({
        userId: user.id,
        action: "auth.failed",
        entityType: "user",
        entityId: user.id,
        summary: "Невдала спроба входу",
      });
      throw new HttpError(401, "invalid_credentials");
    }
    if (!user.isActive) throw new HttpError(403, "user_inactive");

    await createSession(user.id);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await writeAudit({
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      summary: user.email,
    });
    return jsonOk({ ok: true, locale: user.locale });
  });
}
