"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader } from "./ui";
import { useConfirm } from "./confirm-provider";
import { useLocale, useT } from "./i18n-provider";

type Stats = {
  dbSizeBytes: number;
  uploadsCount: number;
  uploadsSizeBytes: number;
  expiredSessionsCount: number;
  totalRequests: number;
  closedRequestsCount: number;
  totalNomenclature: number;
};

type BackupFile = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 Б";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("uk-UA")} ${d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch {
    return iso;
  }
}

export function MaintenancePanel() {
  const locale = useLocale();
  const isUk = locale === "uk";
  const [stats, setStats] = useState<Stats | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const confirm = useConfirm();

  async function loadData() {
    try {
      const [statsRes, backupsRes] = await Promise.all([
        fetch("/api/admin/maintenance"),
        fetch("/api/admin/backup"),
      ]);

      if (statsRes.ok) {
        const data = (await statsRes.json()) as Stats;
        setStats(data);
      }
      if (backupsRes.ok) {
        const data = (await backupsRes.json()) as { backups: BackupFile[] };
        setBackups(data.backups || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateBackup() {
    setBusyAction("create_backup");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { filename: string; sizeBytes: number };
        setMessage(
          isUk
            ? `Резервну копію «${data.filename}» (${formatBytes(data.sizeBytes)}) успішно збережено на сервері.`
            : `Backup snapshot "${data.filename}" (${formatBytes(data.sizeBytes)}) saved on server.`,
        );
        await loadData();
      } else {
        setMessage(isUk ? "Помилка під час створення резервної копії." : "Failed to create database backup.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteBackup(filename: string) {
    const ok = await confirm({
      title: isUk ? "Видалення резервної копії" : "Delete Backup Snapshot",
      message: isUk
        ? `Ви дійсно бажаєте видалити файл копії «${filename}» із сервера?`
        : `Are you sure you want to delete backup file "${filename}" from the server?`,
      confirmText: isUk ? "Видалити файл" : "Delete File",
      tone: "danger",
    });
    if (!ok) return;

    setBusyAction(`delete_${filename}`);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/backup?file=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage(isUk ? `Файл «${filename}» видалено із сервера.` : `File "${filename}" deleted from server.`);
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCleanSessions() {
    setBusyAction("sessions");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clean_sessions" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setMessage(isUk ? `Очищено ${data.count} застарілих сесій.` : `Purged ${data.count} expired sessions.`);
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleVacuum() {
    const ok = await confirm({
      title: isUk ? "Оптимізація бази даних" : "Database Defragmentation (VACUUM)",
      message: isUk
        ? "Виконати операцію VACUUM та скидання журналу WAL? Це дефрагментує файл та звільнить невикористане місце на диску."
        : "Execute VACUUM & checkpoint WAL journal? This reclaims unused disk space.",
      confirmText: isUk ? "Виконати оптимізацію" : "Run VACUUM",
    });
    if (!ok) return;

    setBusyAction("vacuum");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vacuum" }),
      });
      if (res.ok) {
        setMessage(isUk ? "Оптимізацію та дефрагментацію бази успішно завершено." : "Database optimization & VACUUM completed successfully.");
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Картка резервного копіювання */}
      <Card>
        <CardHeader
          title={isUk ? "Резервне копіювання бази даних" : "Database Backups & Snapshots"}
          description={isUk ? "Збереження копій локально на сервері поруч із базою (папка data/backups/)" : "Backups are stored locally on server alongside database (folder data/backups/)"}
          actions={
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busyAction !== null}
              onClick={handleCreateBackup}
              className="flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>{busyAction === "create_backup" ? (isUk ? "Створення копії..." : "Creating snapshot...") : (isUk ? "Створити резервну копію на сервері" : "Create Server Backup Now")}</span>
            </Button>
          }
        />
        <div className="p-5 space-y-5">
          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              ✓ {message}
            </div>
          ) : null}

          {/* Статистичні плашки */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{isUk ? "Робоча база (.db)" : "Active Database (.db)"}</span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading ? "..." : formatBytes(stats?.dbSizeBytes ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{isUk ? "Вкладення (фото)" : "Attachments (Uploads)"}</span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading ? "..." : `${stats?.uploadsCount ?? 0} ${isUk ? "шт." : "files"} (${formatBytes(stats?.uploadsSizeBytes ?? 0)})`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{isUk ? "Збережених копій" : "Saved Backups"}</span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading ? "..." : `${backups.length} ${isUk ? "файлів" : "files"}`}
              </p>
            </div>
          </div>

          {/* Список наявних копій на сервері */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isUk ? "Збережені файли резервних копій на сервері" : "Saved backup files on server"}
              </span>
              <span className="text-[11px] text-slate-400">{isUk ? "Шлях:" : "Path:"} data/backups/</span>
            </div>

            {backups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 bg-slate-50/40">
                {isUk
                  ? "На сервері ще немає збережених копій. Натисніть кнопку «Створити резервну копію на сервері», щоб записати перший знімок."
                  : "No backups saved on server yet. Click 'Create Server Backup Now' to create your first snapshot."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">{isUk ? "Файл копії" : "Backup File"}</th>
                      <th className="px-4 py-3">{isUk ? "Дата та час створення" : "Created At"}</th>
                      <th className="px-4 py-3">{isUk ? "Розмір" : "Size"}</th>
                      <th className="px-4 py-3 text-right">{isUk ? "Дії" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                          <span className="text-slate-400">🗄️</span>
                          <span className="font-mono text-xs">{b.filename}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(b.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{formatBytes(b.sizeBytes)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/api/admin/backup?file=${encodeURIComponent(b.filename)}`}
                              download
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
                              title={isUk ? "Завантажити копію на ваш комп'ютер" : "Download snapshot to computer"}
                            >
                              <span>📥</span>
                              <span>{isUk ? "Завантажити" : "Download"}</span>
                            </a>
                            <button
                              type="button"
                              disabled={busyAction === `delete_${b.filename}`}
                              onClick={() => handleDeleteBackup(b.filename)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                              title={isUk ? "Видалити цю копію із сервера" : "Delete snapshot from server"}
                            >
                              <span>🗑️</span>
                              <span>{isUk ? "Видалити" : "Delete"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Картка очищення та обслуговування */}
      <Card>
        <CardHeader
          title={isUk ? "Очищення та оптимізація бази даних" : "Database Cleanup & Optimization"}
          description={isUk ? "Технічне обслуговування сховища та сесій" : "Storage maintenance and session purge"}
        />
        <div className="p-5 space-y-4">
          <div className="divide-y divide-slate-100">
            {/* Очищення сесій */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">{isUk ? "Очищення застарілих авторизаційних сесій" : "Purge Expired Sessions"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isUk ? "Видаляє прострочені сесії входу з бази даних. Наразі застарілих: " : "Removes expired login tokens from database. Currently expired: "}
                  <span className="font-semibold text-slate-700">{loading ? "..." : stats?.expiredSessionsCount}</span>.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyAction !== null || (stats?.expiredSessionsCount ?? 0) === 0}
                onClick={handleCleanSessions}
                className="shrink-0"
              >
                {busyAction === "sessions" ? (isUk ? "Очищення..." : "Purging...") : (isUk ? "Очистити старі сесії" : "Purge Expired Sessions")}
              </Button>
            </div>

            {/* VACUUM */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">{isUk ? "Оптимізація та дефрагментація файлу бази (VACUUM)" : "Database Defragmentation (VACUUM)"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isUk ? "Скидає буфер транзакцій WAL і стискає файл бази на диску, повертаючи вільний простір операційній системі." : "Checkpoints WAL journal and defragments database file on disk, reclaiming unused space."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyAction !== null}
                onClick={handleVacuum}
                className="shrink-0"
              >
                {busyAction === "vacuum" ? (isUk ? "Оптимізація..." : "Running...") : (isUk ? "Виконати VACUUM" : "Run VACUUM")}
              </Button>
            </div>

            {/* Статистика закритих заявок */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">{isUk ? "Архівний стан заявок" : "Request Archive Statistics"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isUk
                    ? `Усього завершених або скасованих заявок: ${loading ? "..." : stats?.closedRequestsCount} (з ${stats?.totalRequests} загалом).`
                    : `Total completed or cancelled requests: ${loading ? "..." : stats?.closedRequestsCount} (of ${stats?.totalRequests} total).`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
