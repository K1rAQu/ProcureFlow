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

function getBackupPolicy() {
  const isDemoMode = process.env.DEMO_MODE === "true";
  const backupsAllowed = process.env.ALLOW_DATABASE_BACKUPS !== "false";
  const maxBackups = Number(process.env.MAX_BACKUPS_COUNT) || (isDemoMode ? 2 : 10);
  const cooldownSeconds = Number(process.env.BACKUP_COOLDOWN_SECONDS) || (isDemoMode ? 60 : 15);

  return {
    isDemoMode,
    backupsAllowed,
    maxBackups,
    cooldownSeconds,
  };
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");
    const url = new URL(request.url);
    const requestedFile = url.searchParams.get("file");

    const backupsDir = getBackupsDir();
    await mkdir(backupsDir, { recursive: true });

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
    const backups: { filename: string; sizeBytes: number; createdAt: string; timestamp: number }[] = [];

    for (const entry of entries) {
      if (!isValidBackupFilename(entry)) continue;
      const fullPath = resolve(backupsDir, entry);
      const fileStat = await stat(fullPath).catch(() => null);
      if (fileStat && fileStat.isFile()) {
        const time = fileStat.mtime.getTime();
        backups.push({
          filename: entry,
          sizeBytes: fileStat.size,
          createdAt: fileStat.mtime.toISOString(),
          timestamp: time,
        });
      }
    }

    // Сортування: найновіші зверху
    backups.sort((a, b) => b.timestamp - a.timestamp);

    const policy = getBackupPolicy();

    return jsonOk({
      backups: backups.map(({ filename, sizeBytes, createdAt }) => ({ filename, sizeBytes, createdAt })),
      isDemoMode: policy.isDemoMode,
      backupsAllowed: policy.backupsAllowed,
      maxBackups: policy.maxBackups,
      cooldownSeconds: policy.cooldownSeconds,
    });
  });
}

export async function POST() {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");
    const policy = getBackupPolicy();

    // 1. Перевірка чи дозволено створення копій
    if (!policy.backupsAllowed) {
      throw new HttpError(403, "backups_disabled_in_demo");
    }

    const backupsDir = getBackupsDir();
    await mkdir(backupsDir, { recursive: true });

    // 2. Зчитуємо наявні файли для перевірки кулдауну та квоти
    const entries = await readdir(backupsDir).catch(() => []);
    const existing: { filename: string; fullPath: string; time: number }[] = [];

    for (const entry of entries) {
      if (!isValidBackupFilename(entry)) continue;
      const fullPath = resolve(backupsDir, entry);
      const st = await stat(fullPath).catch(() => null);
      if (st && st.isFile()) {
        existing.push({ filename: entry, fullPath, time: st.mtime.getTime() });
      }
    }

    existing.sort((a, b) => b.time - a.time); // найновіші спочатку

    // 3. Захист від флуду (cooldown)
    if (existing.length > 0) {
      const mostRecentTime = existing[0].time;
      const elapsedSeconds = Math.floor((Date.now() - mostRecentTime) / 1000);
      if (elapsedSeconds < policy.cooldownSeconds) {
        const remaining = policy.cooldownSeconds - elapsedSeconds;
        throw new HttpError(429, `cooldown_active:${remaining}`);
      }
    }

    // 4. Захист диска (Retention / автоочищення найстаріших копій)
    if (existing.length >= policy.maxBackups) {
      // Видаляємо найстаріші файли, щоб вмістити нову копію
      const itemsToDelete = existing.slice(policy.maxBackups - 1);
      for (const item of itemsToDelete) {
        await unlink(item.fullPath).catch(() => null);
      }
    }

    // 5. Скидаємо WAL-журнал у файл бази перед копіюванням
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

    // 6. Формуємо унікальну назву з датою та часом: procurement-backup-2026-10-23_09-15-30.db
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const dateStamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const filename = `procurement-backup-${dateStamp}.db`;
    const targetPath = resolve(backupsDir, filename);

    // 7. Записуємо файл копії на сервері
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
