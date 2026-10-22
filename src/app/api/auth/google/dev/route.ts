import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { countUsers, ensureCoreData } from "@/lib/bootstrap";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; fullName?: string };
  const email = (body.email || "developer@google.com").trim().toLowerCase();
  const fullName = (body.fullName || "Google Користувач").trim();
  const googleId = `dev-google-${email}`;

  await ensureCoreData();

  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.googleId, googleId), eq(users.email, email)))
    .limit(1);

  const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
  const [userRole] = await db.select().from(roles).where(eq(roles.code, "user")).limit(1);
  const userCount = await countUsers();
  const isFirstUser = userCount === 0;
  const isAdminEmail = email.startsWith("admin@") || isFirstUser;

  const settings = await getSettings();

  if (existing) {
    const patch: Record<string, unknown> = { googleId, lastLoginAt: new Date() };
    if (isAdminEmail && adminRole && existing.roleId !== adminRole.id) {
      patch.roleId = adminRole.id;
    }
    await db
      .update(users)
      .set(patch)
      .where(eq(users.id, existing.id));

    await createSession(existing.id);
    return NextResponse.json({ ok: true, userId: existing.id, pendingApproval: !existing.isActive });
  }

  const roleId = isAdminEmail ? (adminRole?.id ?? 1) : (userRole?.id ?? 1);
  const isActive = isAdminEmail || isFirstUser || !settings.requireUserApproval;

  const [created] = await db
    .insert(users)
    .values({
      email,
      fullName,
      googleId,
      roleId,
      locale: settings.defaultLocale ?? "uk",
      isActive,
      lastLoginAt: isActive ? new Date() : null,
    })
    .returning({ id: users.id });

  await writeAudit({
    userId: created.id,
    action: isFirstUser ? "system.setup" : "auth.google_register",
    entityType: "user",
    entityId: created.id,
    summary: `[Dev Mode] Вхід/реєстрація Google: ${email}${isActive ? "" : " [очікує активації]"}`,
  });

  await createSession(created.id);
  return NextResponse.json({ ok: true, userId: created.id, pendingApproval: !isActive });
}
