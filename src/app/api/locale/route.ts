import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { getCurrentUser, HttpError } from "@/lib/auth";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = (await readJson(request)) as { locale?: string };
    if (!isLocale(body.locale)) throw new HttpError(400, "invalid_locale");
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, body.locale, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    const user = await getCurrentUser();
    if (user) {
      await db.update(users).set({ locale: body.locale }).where(eq(users.id, user.id));
    }
    return jsonOk({ ok: true, locale: body.locale });
  });
}
