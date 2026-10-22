"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconKanban, IconTable } from "./icons";
import { useT } from "./i18n-provider";

export function ViewModeToggle({ currentView }: { currentView: "kanban" | "table" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(view: "kanban" | "table") {
    document.cookie = `procurement_view_mode=${view}; path=/; max-age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem("procurement_view_mode", view);
    } catch {}

    const next = new URLSearchParams(searchParams ? searchParams.toString() : "");
    next.set("view", view);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
      <button
        type="button"
        onClick={() => setView("kanban")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
          currentView === "kanban"
            ? "bg-[#12325c] text-white shadow-xs font-semibold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        }`}
        title="Канбан-дошка"
      >
        <IconKanban className="h-3.5 w-3.5" />
        <span>{t("common.board")}</span>
      </button>
      <button
        type="button"
        onClick={() => setView("table")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
          currentView === "table"
            ? "bg-[#12325c] text-white shadow-xs font-semibold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        }`}
        title={t("common.table")}
      >
        <IconTable className="h-3.5 w-3.5" />
        <span>{t("common.table")}</span>
      </button>
    </div>
  );
}
