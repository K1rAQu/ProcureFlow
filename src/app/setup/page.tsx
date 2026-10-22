import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth-forms";
import { I18nProvider } from "@/components/i18n-provider";
import { resolveLocale } from "@/lib/auth";
import { ensureCoreData, isSystemInitialized } from "@/lib/bootstrap";
import { isGoogleOAuthConfigured } from "@/lib/google-auth";
import { createTranslator, getMessages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const initialized = await isSystemInitialized();
  if (initialized) redirect("/login");

  // Створює системні ролі та напрями закупівлі «Імпорт» / «Україна»
  await ensureCoreData();

  const isGoogleConfigured = isGoogleOAuthConfigured();
  const locale = await resolveLocale();
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#12325c] text-sm font-bold text-white">
            ЗК
          </span>
          <h1 className="mt-5 text-lg font-semibold text-slate-900">{t("auth.setupTitle")}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{t("auth.setupText")}</p>
          <SetupForm isGoogleConfigured={isGoogleConfigured} />
          <p className="mt-6 text-xs text-slate-400">
            Довідники виробничих цехів та одиниць виміру можна налаштувати в адмінці після входу.
          </p>
        </div>
      </main>
    </I18nProvider>
  );
}
