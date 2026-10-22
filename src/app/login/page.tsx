import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { I18nProvider } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/nav";
import { getCurrentUser, resolveLocale } from "@/lib/auth";
import { isSystemInitialized } from "@/lib/bootstrap";
import { isGoogleOAuthConfigured } from "@/lib/google-auth";
import { createTranslator, getMessages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const initialized = await isSystemInitialized();
  if (!initialized) redirect("/setup");

  const params = await searchParams;
  const initialError = typeof params.error === "string" ? params.error : undefined;
  const isGoogleConfigured = isGoogleOAuthConfigured();

  const locale = await resolveLocale();
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid lg:grid-cols-2">
          <div className="brand-gradient hidden flex-col justify-between p-10 lg:flex">
            <div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-lg font-bold text-white">
                {t("app.logo")}
              </span>
              <h1 className="mt-6 text-2xl font-semibold text-white">{t("app.name")}</h1>
              <p className="mt-2 max-w-sm text-sm text-slate-300">{t("app.subtitle")}</p>
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>• {t("auth.benefit1")}</li>
              <li>• {t("auth.benefit2")}</li>
              <li>• {t("auth.benefit3")}</li>
              <li>• {t("auth.benefit4")}</li>
            </ul>
          </div>
          <div className="p-8 sm:p-10 relative">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t("auth.login")}</h2>
                <p className="text-xs text-slate-500">{t("app.subtitle")}</p>
              </div>
              <LocaleSwitcher />
            </div>
            {params.reason === "timeout" ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-2xs">
                <span className="text-lg leading-none">⏱</span>
                <div>
                  <p className="font-semibold">{t("auth.sessionTimeoutTitle")}</p>
                  <p className="mt-0.5 text-amber-800">{t("auth.sessionTimeoutDesc")}</p>
                </div>
              </div>
            ) : null}
            <LoginForm isGoogleConfigured={isGoogleConfigured} initialError={initialError} />
            <p className="mt-6 text-center text-xs text-slate-400">
              <Link href="/setup" className="hover:text-slate-600">
                {t("auth.noUsersHint")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </I18nProvider>
  );
}
