"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardHeader } from "./ui";
import { useConfirm } from "./confirm-provider";
import { useT } from "./i18n-provider";

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
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

export function MaintenancePanel() {
  const t = useT();
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
          t("admin.maintenance.backupSuccess", {
            filename: data.filename,
            size: formatBytes(data.sizeBytes),
          }),
        );
        await loadData();
      } else {
        setMessage(t("admin.maintenance.backupError"));
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteBackup(filename: string) {
    const ok = await confirm({
      title: t("admin.maintenance.deleteTitle"),
      message: t("admin.maintenance.deleteConfirm", { filename }),
      confirmText: t("admin.maintenance.deleteButton"),
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
        setMessage(t("admin.maintenance.deleteSuccess", { filename }));
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
        setMessage(t("admin.maintenance.cleanSessionsSuccess", { count: data.count }));
        await loadData();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleVacuum() {
    const ok = await confirm({
      title: t("admin.maintenance.vacuumTitle"),
      message: t("admin.maintenance.vacuumConfirm"),
      confirmText: t("admin.maintenance.vacuumButton"),
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
        setMessage(t("admin.maintenance.vacuumSuccess"));
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
          title={t("admin.maintenance.backupsTitle")}
          description={t("admin.maintenance.backupsDesc")}
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
              <span>
                {busyAction === "create_backup"
                  ? t("admin.maintenance.creating")
                  : t("admin.maintenance.createButton")}
              </span>
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
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {t("admin.maintenance.statDb")}
              </span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading ? "..." : formatBytes(stats?.dbSizeBytes ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {t("admin.maintenance.statUploads")}
              </span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading
                  ? "..."
                  : `${t("admin.maintenance.piecesCount", { count: stats?.uploadsCount ?? 0 })} (${formatBytes(stats?.uploadsSizeBytes ?? 0)})`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {t("admin.maintenance.statBackups")}
              </span>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {loading ? "..." : t("admin.maintenance.filesCount", { count: backups.length })}
              </p>
            </div>
          </div>

          {/* Список наявних копій на сервері */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t("admin.maintenance.tableTitle")}
              </span>
              <span className="text-[11px] text-slate-400">
                {t("admin.maintenance.pathPrefix")} data/backups/
              </span>
            </div>

            {backups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 bg-slate-50/40">
                {t("admin.maintenance.noBackups")}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">{t("admin.maintenance.colFile")}</th>
                      <th className="px-4 py-3">{t("admin.maintenance.colCreated")}</th>
                      <th className="px-4 py-3">{t("admin.maintenance.colSize")}</th>
                      <th className="px-4 py-3 text-right">{t("admin.maintenance.colActions")}</th>
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
                              title={t("admin.maintenance.downloadTooltip")}
                            >
                              <span>📥</span>
                              <span>{t("admin.maintenance.download")}</span>
                            </a>
                            <button
                              type="button"
                              disabled={busyAction === `delete_${b.filename}`}
                              onClick={() => handleDeleteBackup(b.filename)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                              title={t("admin.maintenance.deleteTooltip")}
                            >
                              <span>🗑️</span>
                              <span>{t("admin.maintenance.delete")}</span>
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
          title={t("admin.maintenance.cleanupTitle")}
          description={t("admin.maintenance.cleanupDesc")}
        />
        <div className="p-5 space-y-4">
          <div className="divide-y divide-slate-100">
            {/* Очищення сесій */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {t("admin.maintenance.cleanSessionsTitle")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("admin.maintenance.cleanSessionsDesc")}
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
                {busyAction === "sessions"
                  ? t("admin.maintenance.purging")
                  : t("admin.maintenance.cleanSessionsButton")}
              </Button>
            </div>

            {/* VACUUM */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {t("admin.maintenance.vacuumCardTitle")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("admin.maintenance.vacuumCardDesc")}
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
                {busyAction === "vacuum"
                  ? t("admin.maintenance.running")
                  : t("admin.maintenance.vacuumRunButton")}
              </Button>
            </div>

            {/* Статистика закритих заявок */}
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {t("admin.maintenance.archiveTitle")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("admin.maintenance.archiveDesc")}
                  <span className="font-semibold text-slate-700">{loading ? "..." : stats?.closedRequestsCount}</span>
                  {" ("}
                  <span className="text-slate-500">
                    {t("common.of")} {loading ? "..." : stats?.totalRequests}
                  </span>
                  {")"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
