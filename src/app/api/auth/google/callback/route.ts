import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { createSession, isCorporateEmailAllowed } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { countUsers, ensureCoreData } from "@/lib/bootstrap";
import { exchangeGoogleCode, getGoogleRedirectUri, getGoogleUserProfile } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=google_denied`, request.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL(`/login?error=invalid_state`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, request.url));
  }

  try {
    const redirectUri = getGoogleRedirectUri(request);
    const { access_token } = await exchangeGoogleCode(code, redirectUri);
    const profile = await getGoogleUserProfile(access_token);

    if (!profile.email) {
      return NextResponse.redirect(new URL(`/login?error=no_email_from_google`, request.url));
    }

    await ensureCoreData();

    const normalizedEmail = profile.email.trim().toLowerCase();

    // Перевірка обмеження на єдиний корпоративний домен (якщо задано в .env)
    if (!isCorporateEmailAllowed(normalizedEmail)) {
      return NextResponse.redirect(new URL(`/login?error=corporate_domain_required`, request.url));
    }

    // Перевіряємо існуючого користувача
    const [existing] = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, profile.sub), eq(users.email, normalizedEmail)))
      .limit(1);

    if (existing) {
      if (!existing.isActive) {
        return NextResponse.redirect(new URL(`/login?error=user_inactive`, request.url));
      }

      await db
        .update(users)
        .set({
          googleId: profile.sub,
          avatarUrl: profile.picture ?? existing.avatarUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));

      await createSession(existing.id);

      await writeAudit({
        userId: existing.id,
        action: "auth.google_login",
        entityType: "user",
        entityId: existing.id,
        summary: `Вхід через Google: ${normalizedEmail}`,
      });

      return NextResponse.redirect(new URL("/", request.url));
    }

    // Реєстрація нового користувача через Google
    const userCount = await countUsers();
    const isFirstUser = userCount === 0;

    let roleId: number;
    if (isFirstUser) {
      const [adminRole] = await db.select().from(roles).where(eq(roles.code, "admin")).limit(1);
      roleId = adminRole?.id ?? 1;
    } else {
      const [userRole] = await db.select().from(roles).where(eq(roles.code, "user")).limit(1);
      roleId = userRole?.id ?? 1;
    }

    const [created] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        fullName: profile.name?.trim() || normalizedEmail.split("@")[0],
        googleId: profile.sub,
        avatarUrl: profile.picture ?? null,
        roleId,
        locale: "uk",
        isActive: true,
        lastLoginAt: new Date(),
      })
      .returning({ id: users.id });

    if (isFirstUser) {
      await writeAudit({
        userId: created.id,
        action: "system.setup",
        entityType: "user",
        entityId: created.id,
        summary: `Створено першого адміністратора через Google: ${normalizedEmail}`,
      });
    } else {
      await writeAudit({
        userId: created.id,
        action: "auth.google_register",
        entityType: "user",
        entityId: created.id,
        summary: `Реєстрація нового користувача через Google: ${normalizedEmail}`,
      });
    }

    await createSession(created.id);
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("Google OAuth error:", err);
    return NextResponse.redirect(new URL(`/login?error=google_auth_failed`, request.url));
  }
}
