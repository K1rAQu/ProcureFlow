"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "./ui";
import { IconClock, IconLogout } from "./icons";
import { useT } from "./i18n-provider";
import { initials } from "@/lib/format";

export function PendingApprovalCard({
  fullName,
  email,
  avatarUrl,
  roleName,
}: {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  roleName?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleCheckStatus() {
    setChecking(true);
    // Спробуємо перейти на головну: якщо адмін вже активував, пустить на дашборд
    window.location.href = "/";
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-xl bg-white">
      {/* Верхній градієнтний банер */}
      <div className="bg-gradient-to-r from-[#12325c] to-[#1e4b85] p-6 text-white text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner">
          ⏳
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">{t("auth.pendingApprovalTitle")}</h1>
        <p className="mt-1 text-xs text-slate-200 max-w-sm mx-auto">
          {t("auth.pendingApprovalSubtitle")}
        </p>
      </div>

      <div className="p-6 space-y-5">
        {/* Картка користувача */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-xs" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {initials(fullName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 truncate">{fullName}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {t("admin.statusPending")}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{email}</p>
            {roleName ? <p className="text-[11px] text-slate-400 mt-0.5">{roleName}</p> : null}
          </div>
        </div>

        {/* Інформаційний блок */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5 text-amber-900">
            <span>ℹ️</span> {t("auth.pendingNoticeTitle")}
          </p>
          <p className="leading-relaxed text-amber-900/90">{t("auth.pendingApprovalNotice")}</p>
        </div>

        {/* Кнопки дій */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full justify-center gap-2"
            disabled={checking || loggingOut}
            onClick={handleCheckStatus}
          >
            <IconClock className="h-4 w-4" />
            <span>{checking ? t("common.loading") : t("auth.checkStatus")}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full sm:w-auto justify-center gap-1.5 text-slate-600 hover:text-slate-900"
            disabled={checking || loggingOut}
            onClick={handleLogout}
          >
            <IconLogout className="h-4 w-4" />
            <span>{t("nav.logout")}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
