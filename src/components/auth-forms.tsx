"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconGoogle } from "./icons";
import { useT } from "./i18n-provider";

function errorMessage(code: string, t: (key: string) => string): string {
  switch (code) {
    case "invalid_credentials":
      return t("auth.invalid");
    case "user_inactive":
      return t("auth.inactive");
    case "google_not_configured":
      return t("auth.googleNotConfigured");
    case "google_denied":
      return t("auth.googleDenied");
    case "corporate_domain_required":
      return t("auth.corporateDomainRequired");
    case "google_auth_failed":
    case "invalid_state":
    case "missing_code":
    case "no_email_from_google":
      return t("auth.googleAuthFailed");
    case "validation_error":
      return t("error.generic");
    default:
      return t("error.generic");
  }
}

export function LoginForm({
  isGoogleConfigured = false,
  initialError,
}: {
  isGoogleConfigured?: boolean;
  initialError?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ? errorMessage(initialError, t) : null);
  const [devBusy, setDevBusy] = useState(false);

  async function handleDevGoogleLogin(email = "admin@company.com", fullName = "Alex Morgan (Admin)") {
    setDevBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });
      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as { pendingApproval?: boolean };
        if (data.pendingApproval) {
          router.replace("/pending-approval");
        } else {
          router.replace("/");
        }
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(errorMessage(data.error || "error", t));
    } catch {
      setError(t("error.generic"));
    } finally {
      setDevBusy(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Кнопка входу виключно через Google / Gmail */}
      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center gap-3.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 hover:shadow-md active:scale-[0.99]"
      >
        <IconGoogle className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">{t("auth.googleSignIn")}</span>
      </a>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-slate-500 leading-relaxed px-2">
        {t("auth.googleOnlyHint")}
      </p>

      {!isGoogleConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 space-y-3">
          <div>
            <p className="font-semibold text-amber-950">💡 {t("auth.googleNotConfigured")}</p>
            <p className="mt-0.5 text-[11px] text-amber-800 leading-normal">
              {t("auth.googleEnvHint")}
            </p>
          </div>
          <div className="border-t border-amber-200/80 pt-3">
            <p className="text-[11px] font-semibold text-amber-900 mb-2">
              ⚡ {t("auth.googleDevSignIn")} (1-Click Google Emulator):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={devBusy}
                onClick={() => handleDevGoogleLogin("admin@company.com", "Alex Morgan (Admin)")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white border border-amber-300/80 p-2.5 text-left text-xs font-medium text-slate-800 shadow-2xs hover:bg-amber-100/60 transition disabled:opacity-50"
              >
                <span className="text-base shrink-0">👑</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate text-slate-900">Admin</p>
                  <p className="text-[10px] text-slate-500 truncate">admin@company.com</p>
                </div>
              </button>
              <button
                type="button"
                disabled={devBusy}
                onClick={() => handleDevGoogleLogin("buyer@company.com", "Elena Rostova (Lead Buyer)")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white border border-amber-300/80 p-2.5 text-left text-xs font-medium text-slate-800 shadow-2xs hover:bg-amber-100/60 transition disabled:opacity-50"
              >
                <span className="text-base shrink-0">💼</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate text-slate-900">Buyer</p>
                  <p className="text-[10px] text-slate-500 truncate">buyer@company.com</p>
                </div>
              </button>
              <button
                type="button"
                disabled={devBusy}
                onClick={() => handleDevGoogleLogin("shop@company.com", "Taras Shevchenko (Shop Manager)")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white border border-amber-300/80 p-2.5 text-left text-xs font-medium text-slate-800 shadow-2xs hover:bg-amber-100/60 transition disabled:opacity-50"
              >
                <span className="text-base shrink-0">🏭</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate text-slate-900">Shop Manager</p>
                  <p className="text-[10px] text-slate-500 truncate">shop@company.com</p>
                </div>
              </button>
              <button
                type="button"
                disabled={devBusy}
                onClick={() => handleDevGoogleLogin("requester@company.com", "David Miller (Hardware Engineer)")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white border border-amber-300/80 p-2.5 text-left text-xs font-medium text-slate-800 shadow-2xs hover:bg-amber-100/60 transition disabled:opacity-50"
              >
                <span className="text-base shrink-0">🔧</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate text-slate-900">Requester</p>
                  <p className="text-[10px] text-slate-500 truncate">requester@company.com</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SetupForm({ isGoogleConfigured = false }: { isGoogleConfigured?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);

  async function handleDevGoogleSetup() {
    setDevBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@company.com", fullName: "Alex Morgan (Admin)" }),
      });
      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError(errorMessage(data.error || "error", t));
    } catch {
      setError(t("error.generic"));
    } finally {
      setDevBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Створення першого адміністратора виключно через Google */}
      <a
        href="/api/auth/google"
        className="flex w-full items-center justify-center gap-3.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 hover:shadow-md active:scale-[0.99]"
      >
        <IconGoogle className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">{t("auth.googleSignIn")}</span>
      </a>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs text-slate-500 leading-relaxed px-2">
        {t("auth.googleOnlyHint")}
      </p>

      {!isGoogleConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 space-y-2.5">
          <p className="font-semibold">💡 {t("auth.googleNotConfigured")}</p>
          <p className="text-[11px] text-amber-700 leading-normal">
            {t("auth.googleEnvHint")}
          </p>
          <div className="border-t border-amber-200/80 pt-2.5">
            <button
              type="button"
              disabled={devBusy}
              onClick={handleDevGoogleSetup}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {devBusy ? t("common.loading") : `⚡ ${t("auth.googleDevSignIn")}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
