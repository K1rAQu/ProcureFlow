"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn, initials } from "@/lib/format";
import { IconLogout } from "./icons";
import { useLocale, useT } from "./i18n-provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export type NavItem = { href: string; labelKey: string; icon: string };

export function SidebarNav({
  items,
  user,
}: {
  items: NavItem[];
  user: { fullName: string; email: string; roleName: string; avatarUrl?: string | null };
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.find((i) => i.href === "/requests/new") ? (
        <Link
          href="/requests/new"
          onClick={() => setOpen(false)}
          className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-[#12325c] shadow-sm transition hover:bg-slate-100"
        >
          <span className="text-sm font-bold">＋</span>
          <span>{t("nav.newRequest")}</span>
        </Link>
      ) : null}

      {items
        .filter((item) => item.href !== "/requests/new")
        .map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition",
                active
                  ? "bg-white/20 font-semibold text-white shadow-2xs"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <span aria-hidden className="w-5 text-center text-sm">
                {item.icon}
              </span>
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
    </nav>
  );

  return (
    <>
      {/* Мобильная шапка */}
      <div className="no-print print:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="menu"
          className="rounded-lg p-2 text-slate-600 ring-1 ring-slate-200"
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
        <span className="text-sm font-semibold text-slate-800">{t("app.name")}</span>
        <span className="flex items-center gap-2">
          <LocaleSwitcher />
          <NotificationsBell />
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-[#12325c]" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#12325c] text-xs font-semibold text-white">
              {initials(user.fullName)}
            </span>
          )}
        </span>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "no-print print:hidden brand-gradient fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:self-start lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white">
            {t("app.logo")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{t("app.name")}</p>
            <p className="truncate text-[11px] text-slate-300">{t("app.subtitle")}</p>
          </div>
        </div>
        {links}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                  {initials(user.fullName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{user.fullName}</p>
                <p className="truncate text-[11px] text-slate-300">{user.roleName}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function switchLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem(LOCALE_COOKIE, next);
    } catch {}
    router.refresh();
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => switchLocale("en")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[11px] transition cursor-pointer",
          locale === "en"
            ? "bg-[#12325c] text-white shadow-2xs font-bold"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
        )}
        title="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchLocale("uk")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[11px] transition cursor-pointer",
          locale === "uk"
            ? "bg-[#12325c] text-white shadow-2xs font-bold"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/60",
        )}
        title="Українська"
      >
        UA
      </button>
    </div>
  );
}

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      title={t("nav.logout")}
      aria-label={t("nav.logout")}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/15 hover:text-white"
    >
      <IconLogout className="h-4 w-4" />
    </button>
  );
}

type NotificationRow = {
  id: number;
  title: string;
  body: string | null;
  isRead: boolean;
  requestId: number | null;
  createdAt: string;
};

export function NotificationsBell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const data = (await response.json()) as { items: NotificationRow[]; unread: number };
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    void load();
    const handleFocus = () => void load();
    window.addEventListener("focus", handleFocus);
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void load();
      }
    }, 15000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            if (!value) void load();
            return !value;
          });
        }}
        className="relative rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="animate-fade-in absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <span className="text-xs font-semibold text-slate-700">{t("notif.title")}</span>
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-800"
              onClick={async () => {
                setUnread(0);
                setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
                await fetch("/api/notifications", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ all: true }),
                });
              }}
            >
              {t("notif.markAll")}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">{t("notif.empty")}</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.requestId ? `/requests/${item.requestId}` : "#"}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block border-b border-slate-100 px-3 py-2 text-xs transition hover:bg-slate-50",
                    item.isRead ? "text-slate-500" : "bg-blue-50/40 font-medium text-slate-800",
                  )}
                >
                  <p className="truncate">{item.title}</p>
                  {item.body ? <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{item.body}</p> : null}
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
