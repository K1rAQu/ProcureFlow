"use client";

import { useState, type ReactNode } from "react";
import { useT } from "./i18n-provider";

export function RequestDetailLayout({
  paramsCard,
  itemsCard,
  historyCard,
  workflowPanel,
  itemsCount,
  actionsCount,
  eventsCount,
}: {
  paramsCard: ReactNode;
  itemsCard: ReactNode;
  historyCard: ReactNode;
  workflowPanel: ReactNode;
  itemsCount: number;
  actionsCount: number;
  eventsCount: number;
}) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<"items" | "actions" | "history" | "all">("items");

  const showFloatingActions = actionsCount > 0 && activeTab !== "actions" && activeTab !== "all";

  return (
    <div>
      {/* Мобільний блок вкладок (< lg) */}
      <div className="lg:hidden sticky top-[53px] z-20 bg-slate-50/95 backdrop-blur-md pt-1 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("items");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all cursor-pointer ${
              activeTab === "items"
                ? "bg-white text-[#12325c] shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📦</span>
            <span className="truncate">{t("request.tabItems")}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "items" ? "bg-blue-100 text-[#12325c]" : "bg-slate-300/60 text-slate-600"
              }`}
            >
              {itemsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("actions");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all cursor-pointer ${
              activeTab === "actions"
                ? "bg-white text-[#12325c] shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>⚡</span>
            <span className="truncate">{t("request.tabActions")}</span>
            {actionsCount > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#12325c]" />
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-white text-[#12325c] shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📜</span>
            <span className="truncate">{t("request.tabHistory")}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "history" ? "bg-blue-100 text-[#12325c]" : "bg-slate-300/60 text-slate-600"
              }`}
            >
              {eventsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`relative flex items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-white text-[#12325c] shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📄</span>
            <span className="truncate">{t("request.tabAll")}</span>
          </button>
        </div>
      </div>

      {/* Контент для мобільних (< lg) */}
      <div className={`lg:hidden space-y-4 ${showFloatingActions ? "pb-20" : ""}`}>
        {activeTab === "items" ? (
          <div className="space-y-4">
            {actionsCount > 0 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#12325c] text-white text-xs font-bold">
                    ⚡
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {t("request.actionRequired")}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      {t("request.actionRequiredDesc")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("actions");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#12325c] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0b1b33] active:scale-95 cursor-pointer"
                >
                  <span>{t("request.viewActions")}</span>
                  <span>→</span>
                </button>
              </div>
            ) : null}

            {paramsCard}
            {itemsCard}

            {actionsCount > 0 ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("actions");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs font-bold text-[#12325c] transition hover:bg-blue-100 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span>{t("request.goToActions", { count: actionsCount })}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "actions" ? (
          <div className="space-y-4">
            {workflowPanel}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("items");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                ← {t("request.tabItems")} ({itemsCount})
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="space-y-4">
            {historyCard}
          </div>
        ) : null}

        {activeTab === "all" ? (
          <div className="space-y-4">
            {paramsCard}
            {itemsCard}
            {workflowPanel}
            {historyCard}
          </div>
        ) : null}
      </div>

      {/* Плаваюча кнопка дій унизу на телефоні */}
      {showFloatingActions ? (
        <div className="lg:hidden fixed bottom-3 left-4 right-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            type="button"
            onClick={() => {
              setActiveTab("actions");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="w-full flex items-center justify-between rounded-xl bg-[#12325c] px-4 py-3 text-white shadow-xl shadow-slate-900/25 active:scale-[0.98] transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20 text-xs font-bold">
                ⚡
              </span>
              <span className="text-xs font-bold">
                {t("request.goToActions", { count: actionsCount })}
              </span>
            </div>
            <span className="text-sm font-bold">→</span>
          </button>
        </div>
      ) : null}

      {/* Десктопний макет (>= lg) */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6 print:block print:space-y-4">
        <div className="lg:col-span-2 space-y-6 print:space-y-4 print:w-full">
          {paramsCard}
          {itemsCard}
          {historyCard}
        </div>
        <div className="space-y-4 no-print print:hidden">
          {workflowPanel}
        </div>
      </div>
    </div>
  );
}
