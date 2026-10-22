import { redirect } from "next/navigation";
import { getCurrentUser, resolveLocale } from "@/lib/auth";
import { createTranslator, getMessages } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n-provider";
import { PendingApprovalCard } from "@/components/pending-approval-card";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const user = await getCurrentUser({ allowInactive: true });

  if (!user) {
    redirect("/login");
  }

  if (user.isActive) {
    redirect("/");
  }

  const locale = await resolveLocale(user);
  const t = createTranslator(locale);

  return (
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      <main className="flex min-h-screen items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-lg">
          <PendingApprovalCard
            fullName={user.fullName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            roleName={user.roleNameUk || user.roleNameRu || user.roleCode}
          />
        </div>
      </main>
    </I18nProvider>
  );
}
