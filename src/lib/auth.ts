import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { roles, sessions, users } from "@/db/schema";
import type { Permission } from "./permissions";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";
import { getSettings } from "./settings";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "procurement_session";
const SESSION_TTL_DAYS = 14;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roleId: number;
  roleCode: string;
  roleNameRu: string;
  roleNameUk: string;
  permissions: string[];
  workshopId: number | null;
  departmentId: number | null;
  locale: Locale;
  isActive: boolean;
};

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const headerList = await headers();
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    userAgent: headerList.get("user-agent")?.slice(0, 250) ?? null,
    ip: getClientIp(headerList),
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export function getClientIp(headerList: Headers): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim().slice(0, 60) ?? null;
  return headerList.get("x-real-ip")?.slice(0, 60) ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      roleId: users.roleId,
      roleCode: roles.code,
      roleNameRu: roles.nameRu,
      roleNameUk: roles.nameUk,
      permissions: roles.permissions,
      workshopId: users.workshopId,
      departmentId: users.departmentId,
      locale: users.locale,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;
  return {
    ...row,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE,
  };
}

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "unauthorized");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) throw new HttpError(403, "forbidden");
  return user;
}

export function assertPermission(user: SessionUser, permission: Permission): void {
  if (!user.permissions.includes(permission)) throw new HttpError(403, "forbidden");
}

/**
 * Перевірка, чи належить email корпоративному домену, якщо вказано CORPORATE_EMAIL_DOMAIN.
 * Змінна зберігається виключно на сервері і ніколи не потрапляє у вихідний код браузера.
 */
export function isCorporateEmailAllowed(email: string): boolean {
  const corporateDomain = (
    process.env.CORPORATE_EMAIL_DOMAIN ||
    process.env.ALLOWED_EMAIL_DOMAINS ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  if (!corporateDomain) return true;
  const domain = email.trim().toLowerCase().split("@")[1];
  return domain === corporateDomain;
}

/**
 * Активна мова інтерфейсу для всієї системи.
 * Визначається централізовано:
 * 1. Налаштуванням в базі даних (встановлює адміністратор у /admin -> Налаштування системи)
 * 2. Змінною середовища DEFAULT_LOCALE в .env (встановлює той, хто розгортає додаток)
 * 3. За замовчуванням: 'en'
 */
export async function resolveLocale(_user?: SessionUser | null): Promise<Locale> {
  try {
    const sysSettings = await getSettings();
    if (sysSettings.defaultLocale && isLocale(sysSettings.defaultLocale)) {
      return sysSettings.defaultLocale;
    }
  } catch {}
  return process.env.DEFAULT_LOCALE === "uk" ? "uk" : "en";
}
