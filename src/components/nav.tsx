"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatRelativeTime, initials } from "@/lib/format";
import { IconLogout } from "./icons";
import { useLocale, useT } from "./i18n-provider";
import { LOCALE_COOKIE, localizeNotification, type Locale } from "@/lib/i18n";

export type NavItem = { href: string; labelKey: string; icon: string };

export function SidebarNav({
  items,
  user,
  initialNotifications = [],
  initialUnread = 0,
}: {
  items: NavItem[];
  user: { fullName: string; email: string; roleName: string; avatarUrl?: string | null };
  initialNotifications?: NotificationRow[];
  initialUnread?: number;
}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const links = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.find((i) => i.href === "/requests/new") ? (
        <Link
          href="/requests/new"
          onClick={() => {
            setOpen(false);
            if (pathname !== "/requests/new") setPendingHref("/requests/new");
          }}
          className={cn(
            "mb-2 flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-[#12325c] shadow-sm transition hover:bg-slate-100",
            pendingHref === "/requests/new" && "opacity-80 ring-2 ring-white/50",
          )}
        >
          {pendingHref === "/requests/new" ? (
            <span className="inline-block animate-spin text-sm">⟳</span>
          ) : (
            <span className="text-sm font-bold">＋</span>
          )}
          <span>{t("nav.newRequest")}</span>
        </Link>
      ) : null}

      {items
        .filter((item) => item.href !== "/requests/new")
        .map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isPending = pendingHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setOpen(false);
                if (pathname !== item.href) setPendingHref(item.href);
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition",
                active
                  ? "bg-white/20 font-semibold text-white shadow-2xs"
                  : isPending
                    ? "bg-white/15 text-white animate-pulse"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <span aria-hidden className="w-5 text-center text-sm">
                {isPending ? (
                  <span className="inline-block animate-spin text-xs">⟳</span>
                ) : (
                  item.icon
                )}
              </span>
              <span className="truncate flex-1">{t(item.labelKey)}</span>
              {isPending ? (
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-ping" />
              ) : null}
            </Link>
          );
        })}
    </nav>
  );

  return (
    <>
      {}
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
          <NotificationsBell initialItems={initialNotifications} initialUnread={initialUnread} />
          {user.avatarUrl ? (

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

export type NotificationRow = {
  id: number;
  type?: string;
  title: string;
  body: string | null;
  isRead: boolean;
  requestId: number | null;
  createdAt: string;
};

function getNotificationIcon(type?: string) {
  switch (type) {
    case "request.submitted":
    case "request_submitted":
      return "📋";
    case "request.status":
    case "request_status":
      return "🔄";
    case "request.comment":
    case "request_comment":
      return "💬";
    case "request.answer":
      return "💡";
    case "request.assigned":
    case "request_assigned":
      return "👤";
    default:
      return "🔔";
  }
}

export function NotificationsBell({
  initialItems = [],
  initialUnread = 0,
}: {
  initialItems?: NotificationRow[];
  initialUnread?: number;
} = {}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const bellRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  const handleItemClick = (item: NotificationRow) => {
    setOpen(false);
    if (!item.isRead) {
      setUnread((count) => Math.max(0, count - 1));
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)));
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
    }
  };

  return (
    <div ref={bellRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            if (!value) void load();
            return !value;
          });
        }}
        className="relative rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 cursor-pointer shadow-2xs"
        title={t("notif.title")}
        aria-label={t("notif.title")}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Мобільний затемнений фон для надійного закриття по дотику */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs transition-opacity sm:hidden animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Меню сповіщень: на мобільному центрується з відступами, на десктопі — випадає під дзвіночком */}
          <div className="fixed left-3 right-3 top-14 z-50 max-h-[82vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-92 sm:max-w-[92vw] sm:max-h-[32rem] sm:rounded-xl sm:z-40 sm:shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3.5 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800">{t("notif.title")}</span>
                {unread > 0 ? (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700">
                    {unread}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {items.some((i) => !i.isRead) ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-slate-600 hover:text-[#12325c] transition cursor-pointer"
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
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 sm:hidden transition cursor-pointer"
                  aria-label="Close"
                >
                  <span className="text-sm font-bold leading-none">✕</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="text-2xl">📭</span>
                  <p className="mt-1.5 text-xs text-slate-500">{t("notif.empty")}</p>
                </div>
              ) : (
                items.map((item) => {
                  const localized = localizeNotification(item, locale);
                  return (
                    <Link
                      key={item.id}
                      href={item.requestId ? `/requests/${item.requestId}` : "#"}
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        "block px-3.5 py-3 sm:py-2.5 text-xs transition hover:bg-slate-50 active:bg-slate-100",
                        item.isRead ? "text-slate-600 bg-white" : "bg-blue-50/50 text-slate-900 font-medium",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs shadow-2xs">
                          {getNotificationIcon(item.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className={cn("truncate text-xs", item.isRead ? "font-medium text-slate-800" : "font-bold text-slate-900")}>
                              {localized.title}
                            </p>
                            {!item.isRead ? (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                            ) : null}
                          </div>
                          {localized.body ? (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 leading-snug">{localized.body}</p>
                          ) : null}
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatRelativeTime(item.createdAt, locale)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
