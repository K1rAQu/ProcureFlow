import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { files, nomenclatureImages, requestItemImages, requestItems, requests } from "@/db/schema";
import { HttpError, type SessionUser } from "./auth";
import { getSettings } from "./settings";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function uploadRoot(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "var", "uploads");
}

function detectMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buffer.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

export async function storeUpload(file: File, user: SessionUser) {
  const settings = await getSettings();
  const maxBytes = settings.maxUploadMb * 1024 * 1024;
  if (file.size <= 0) throw new HttpError(400, "empty_file");
  if (file.size > maxBytes) throw new HttpError(413, "file_too_large");

  const buffer = Buffer.from(await file.arrayBuffer());

  const mime = detectMime(buffer);
  if (!mime || !ALLOWED_MIME[mime]) throw new HttpError(415, "unsupported_file_type");

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ALLOWED_MIME[mime]}`;
  const absolute = path.join(uploadRoot(), key);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer, { mode: 0o600 });

  const [row] = await db
    .insert(files)
    .values({
      storageKey: key,
      originalName: (file.name || "image").slice(0, 250),
      mimeType: mime,
      size: buffer.length,
      checksum,
      uploadedBy: user.id,
    })
    .returning();
  return row;
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const absolute = path.join(uploadRoot(), storageKey);
  const root = uploadRoot();
  if (!absolute.startsWith(root)) throw new HttpError(400, "invalid_path");
  try {
    return await readFile(absolute);
  } catch {
    throw new HttpError(404, "file_missing");
  }
}

/** Доступ к вложению проверяется по связям файла с номенклатурой и заявками. */
export async function canAccessFile(fileId: number, user: SessionUser): Promise<boolean> {
  const [row] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!row) return false;
  if (row.uploadedBy === user.id) return true;

  const nomenclatureLinks = await db
    .select({ id: nomenclatureImages.id })
    .from(nomenclatureImages)
    .where(eq(nomenclatureImages.fileId, fileId))
    .limit(1);
  // Каталог номенклатуры общий для всех авторизованных пользователей
  if (nomenclatureLinks.length && user.permissions.includes("nomenclature.view")) return true;

  const requestLinks = await db
    .select({
      authorId: requests.authorId,
      assigneeId: requests.assigneeId,
      workshopId: requests.workshopId,
    })
    .from(requestItemImages)
    .innerJoin(requestItems, eq(requestItems.id, requestItemImages.requestItemId))
    .innerJoin(requests, eq(requests.id, requestItems.requestId))
    .where(eq(requestItemImages.fileId, fileId));

  for (const link of requestLinks) {
    if (link.authorId === user.id) return true;
    if (link.assigneeId === user.id) return true;
    if (user.permissions.includes("requests.view_all")) return true;
    if (
      user.permissions.includes("requests.view_workshop") &&
      user.workshopId &&
      link.workshopId === user.workshopId
    ) {
      return true;
    }
  }
  return false;
}

/** Проверяет, что переданные id файлов существуют и принадлежат пользователю либо уже связаны с объектом. */
export async function assertOwnedFiles(fileIds: number[], user: SessionUser): Promise<void> {
  if (!fileIds.length) return;
  const rows = await db
    .select({ id: files.id, uploadedBy: files.uploadedBy })
    .from(files)
    .where(inArray(files.id, fileIds));
  if (rows.length !== fileIds.length) throw new HttpError(400, "unknown_file");
  const canUseForeign = user.permissions.includes("nomenclature.edit") || user.permissions.includes("requests.edit_any");
  for (const row of rows) {
    if (row.uploadedBy !== user.id && !canUseForeign) {
      const linked = await db
        .select({ id: nomenclatureImages.id })
        .from(nomenclatureImages)
        .where(eq(nomenclatureImages.fileId, row.id))
        .limit(1);
      if (!linked.length) throw new HttpError(403, "file_forbidden");
    }
  }
}

export async function countFiles(): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)` }).from(files);
  return Number(row?.value ?? 0);
}
