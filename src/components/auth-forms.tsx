"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "./ui";
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
      return "Вхід дозволено лише з корпоративної електронної пошти підприємства.";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ? errorMessage(initialError, t) : null);
  const [busy, setBusy] = useState(false);
  const [devBusy, setDevBusy] = useState(false);

  async function handleDevGoogleLogin() {
    setDevBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@google.com", fullName: "Google Адміністратор" }),
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
    <div className="space-y-5">
      {/* Кнопка входу через Google */}
      <div>
        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]"
        >
          <IconGoogle className="h-5 w-5" />
          <span>{t("auth.googleSignIn")}</span>
        </a>

        {!isGoogleConfigured ? (
          <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
            <p className="font-semibold">💡 {t("auth.googleNotConfigured")}</p>
            <p className="mt-1 text-[11px] text-amber-700">
              Вкажіть <code>GOOGLE_CLIENT_ID</code> та <code>GOOGLE_CLIENT_SECRET</code> у файлі <code>.env</code> для роботи реального OAuth 2.0.
            </p>
            <div className="mt-2.5 border-t border-amber-200/80 pt-2">
              <button
                type="button"
                disabled={devBusy || busy}
                onClick={handleDevGoogleLogin}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {devBusy ? t("common.loading") : `⚡ ${t("auth.googleDevSignIn")}`}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-slate-200" />
        <span className="absolute bg-white px-3 text-xs font-medium text-slate-400">
          {t("auth.orEmail")}
        </span>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (response.ok) {
            router.replace("/");
            router.refresh();
            return;
          }
          const data = (await response.json().catch(() => ({ error: "error" }))) as { error: string };
          setError(errorMessage(data.error, t));
          setBusy(false);
        }}
      >
        <Field label={t("auth.email")} required>
          <Input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
          />
        </Field>
        <Field label={t("auth.password")} required>
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{error}</p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("common.loading") : t("auth.signIn")}
        </Button>
      </form>
    </div>
  );
}

export function SetupForm({ isGoogleConfigured = false }: { isGoogleConfigured?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devBusy, setDevBusy] = useState(false);

  async function handleDevGoogleSetup() {
    setDevBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@google.com", fullName: "Google Головний Адміністратор" }),
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
    <div className="space-y-5">
      {/* Вхід через Google як швидке початкове налаштування */}
      <div>
        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]"
        >
          <IconGoogle className="h-5 w-5" />
          <span>Створити першого адміністратора через Google</span>
        </a>

        {!isGoogleConfigured ? (
          <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
            <p className="font-semibold">💡 {t("auth.googleNotConfigured")}</p>
            <p className="mt-1 text-[11px] text-amber-700">
              Вкажіть <code>GOOGLE_CLIENT_ID</code> та <code>GOOGLE_CLIENT_SECRET</code> у файлі <code>.env</code>.
            </p>
            <div className="mt-2.5 border-t border-amber-200/80 pt-2">
              <button
                type="button"
                disabled={devBusy || busy}
                onClick={handleDevGoogleSetup}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
              >
                {devBusy ? t("common.loading") : "⚡ Створити адміністратора (Dev Mode)"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-slate-200" />
        <span className="absolute bg-white px-3 text-xs font-medium text-slate-400">
          або введіть дані вручну
        </span>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          if (password !== repeat) {
            setError(t("auth.passwordMismatch"));
            return;
          }
          setBusy(true);
          setError(null);
          const response = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, email, password }),
          });
          if (response.ok) {
            router.replace("/");
            router.refresh();
            return;
          }
          const data = (await response.json().catch(() => ({ error: "error" }))) as { error: string };
          setError(data.error === "already_initialized" ? t("error.generic") : errorMessage(data.error, t));
          setBusy(false);
        }}
      >
        <Field label={t("auth.fullName")} required>
          <Input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label={t("auth.email")} required>
          <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label={t("auth.password")} required hint="min. 8">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label={t("auth.passwordRepeat")} required>
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{error}</p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("common.loading") : t("auth.createAdmin")}
        </Button>
      </form>
    </div>
  );
}
