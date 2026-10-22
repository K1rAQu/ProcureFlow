import { copyFile, mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { client } from "@/db";
import { handleRoute, jsonOk } from "@/lib/api";
import { HttpError, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

function getBackupsDir(): string {
  return resolve(process.cwd(), "data", "backups");
}

function isValidBackupFilename(filename: string): boolean {
  return /^procurement-backup-[\w.-]+\.db$/i.test(filename);
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");
    const url = new URL(request.url);
    const requestedFile = url.searchParams.get("file");

    const backupsDir = getBackupsDir();
    await mkdir(backupsDir, { recursive: true });

    // Якщо запитано конкретний файл для завантаження
    if (requestedFile) {
      const cleanName = basename(requestedFile);
      if (!isValidBackupFilename(cleanName)) {
        throw new HttpError(400, "invalid_filename");
      }

      const filePath = resolve(backupsDir, cleanName);
      const fileStats = await stat(filePath).catch(() => null);
      if (!fileStats || !fileStats.isFile()) {
        throw new HttpError(404, "backup_not_found");
      }

      const buffer = await readFile(filePath);

      await writeAudit({
        userId: user.id,
        action: "backup.download",
        entityType: "settings",
        summary: `Завантажено файл резервної копії: ${cleanName} (${(fileStats.size / (1024 * 1024)).toFixed(2)} МБ)`,
      });

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/x-sqlite3",
          "Content-Length": String(fileStats.size),
          "Content-Disposition": `attachment; filename="${cleanName}"`,
          "Cache-Control": "no-store, no-cache",
        },
      });
    }

    // Якщо запитано список наявних збережених копій
    const entries = await readdir(backupsDir).catch(() => []);
    const backups: { filename: string; sizeBytes: number; createdAt: string }[] = [];

    for (const entry of entries) {
      if (!isValidBackupFilename(entry)) continue;
      const fullPath = resolve(backupsDir, entry);
      const fileStat = await stat(fullPath).catch(() => null);
      if (fileStat && fileStat.isFile()) {
        backups.push({
          filename: entry,
          sizeBytes: fileStat.size,
          createdAt: (fileStat.birthtime?.getTime() ? fileStat.birthtime : fileStat.mtime).toISOString(),
        });
      }
    }

    // Сортування: найновіші зверху
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return jsonOk({ backups });
  });
}

export async function POST() {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");

    // 1. Скидаємо WAL-журнал у файл бази перед копіюванням
    try {
      await client.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch (err) {
      console.warn("WAL checkpoint warning:", err);
    }

    const dbPath = resolve(process.cwd(), "data", "procurement.db");
    const sourceStats = await stat(dbPath).catch(() => null);
    if (!sourceStats) {
      throw new Error("Головна база даних data/procurement.db не знайдена");
    }

    // 2. Створюємо папку data/backups поруч із базою
    const backupsDir = getBackupsDir();
    await mkdir(backupsDir, { recursive: true });

    // 3. Формуємо унікальну назву з датою та часом: procurement-backup-2026-10-22_01-15-30.db
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const dateStamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const filename = `procurement-backup-${dateStamp}.db`;
    const targetPath = resolve(backupsDir, filename);

    // 4. Записуємо файл копії на сервері
    await copyFile(dbPath, targetPath);

    const targetStats = await stat(targetPath).catch(() => null);
    const sizeBytes = targetStats?.size ?? sourceStats.size;

    await writeAudit({
      userId: user.id,
      action: "backup.create",
      entityType: "settings",
      summary: `Створено резервну копію бази на сервері: ${filename} (${(sizeBytes / (1024 * 1024)).toFixed(2)} МБ)`,
    });

    return jsonOk(
      {
        success: true,
        filename,
        sizeBytes,
        createdAt: d.toISOString(),
      },
      201,
    );
  });
}

export async function DELETE(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");
    const url = new URL(request.url);
    const filename = url.searchParams.get("file");

    if (!filename || !isValidBackupFilename(filename)) {
      throw new HttpError(400, "invalid_filename");
    }

    const backupsDir = getBackupsDir();
    const filePath = resolve(backupsDir, filename);

    const fileStats = await stat(filePath).catch(() => null);
    if (!fileStats) {
      throw new HttpError(404, "backup_not_found");
    }

    await unlink(filePath);

    await writeAudit({
      userId: user.id,
      action: "backup.delete",
      entityType: "settings",
      summary: `Видалено резервну копію: ${filename}`,
    });

    return jsonOk({ success: true, deleted: filename });
  });
}
