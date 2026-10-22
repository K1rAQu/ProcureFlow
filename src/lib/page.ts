import "server-only";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, unitsOfMeasurement, workshops } from "@/db/schema";
import { getCurrentUser, resolveLocale, type SessionUser } from "@/lib/auth";
import { createTranslator, type Locale } from "@/lib/i18n";

export type PageContext = {
  user: SessionUser;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export async function pageContext(): Promise<PageContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await resolveLocale(user);
  return { user, locale, t: createTranslator(locale) };
}

export async function loadDirectories(onlyActive = true) {
  const departmentRows = await db
    .select()
    .from(departments)
    .where(onlyActive ? eq(departments.isActive, true) : undefined)
    .orderBy(asc(departments.sortOrder), asc(departments.id));
  const workshopRows = await db
    .select()
    .from(workshops)
    .where(onlyActive ? eq(workshops.isActive, true) : undefined)
    .orderBy(asc(workshops.sortOrder), asc(workshops.id));
  const unitRows = await db
    .select()
    .from(unitsOfMeasurement)
    .where(onlyActive ? eq(unitsOfMeasurement.isActive, true) : undefined)
    .orderBy(asc(unitsOfMeasurement.sortOrder), asc(unitsOfMeasurement.id));
  return { departments: departmentRows, workshops: workshopRows, units: unitRows };
}

export function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export function readNumberParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): number | undefined {
  const raw = readParam(params, key);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
