import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ConfirmProvider } from "@/components/confirm-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { LocaleSwitcher, NotificationsBell, SidebarNav, type NavItem } from "@/components/nav";
import { SessionTimeoutWatcher } from "@/components/session-timeout-watcher";
import { getCurrentUser, resolveLocale } from "@/lib/auth";
import { getMessages, localizedName } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const locale = await resolveLocale(user);
  const messages = getMessages(locale);
  const settings = await getSettings();

  const items: NavItem[] = [{ href: "/", labelKey: "nav.dashboard", icon: "◧" }];
  if (user.permissions.includes("requests.create")) {
    items.push({ href: "/requests/new", labelKey: "nav.newRequest", icon: "＋" });
  }
  items.push({ href: "/requests", labelKey: "nav.myRequests", icon: "☰" });
  if (user.permissions.includes("requests.view_all") || user.permissions.includes("requests.view_workshop")) {
    items.push({ href: "/all-requests", labelKey: "nav.allRequests", icon: "▦" });
  }
  if (user.permissions.includes("nomenclature.view")) {
    items.push({ href: "/nomenclature", labelKey: "nav.nomenclature", icon: "⬡" });
  }
  if (
    user.permissions.includes("admin.users") ||
    user.permissions.includes("admin.directories") ||
    user.permissions.includes("admin.roles") ||
    user.permissions.includes("admin.settings")
  ) {
    items.push({ href: "/admin", labelKey: "nav.admin", icon: "⚙" });
  }
  if (user.permissions.includes("audit.view")) {
    items.push({ href: "/audit", labelKey: "nav.audit", icon: "⏱" });
  }

  return (
    <I18nProvider locale={locale} messages={messages}>
      <ConfirmProvider>
        <SessionTimeoutWatcher timeoutMinutes={settings.sessionTimeoutMinutes} />
        <div className="flex min-h-screen flex-col lg:flex-row print:block">
          <SidebarNav
            items={items}
            user={{
              fullName: user.fullName,
              email: user.email,
              avatarUrl: user.avatarUrl ?? null,
              roleName: localizedName(locale, { nameRu: user.roleNameRu, nameUk: user.roleNameUk }),
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col print:block">
            <header className="no-print print:hidden hidden items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3 lg:flex">
              <LocaleSwitcher />
              <span className="text-xs text-slate-500">{user.email}</span>
              <NotificationsBell />
            </header>
            <main className="min-w-0 flex-1 p-4 sm:p-6 print:p-0 print:m-0 print:w-full">{children}</main>
          </div>
        </div>
      </ConfirmProvider>
    </I18nProvider>
  );
}
