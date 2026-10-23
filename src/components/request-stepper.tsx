"use client";

import { useT } from "./i18n-provider";
import { IconCheck, IconX } from "./icons";

const STEPS = [
  { key: "draft" },
  { key: "submitted" },
  { key: "in_review" },
  { key: "purchasing" },
  { key: "ordered" },
  { key: "completed" },
];

const STEP_INDEX: Record<string, number> = {
  draft: 0,
  submitted: 1,
  in_review: 2,
  needs_info: 2,
  purchasing: 3,
  ordered: 4,
  completed: 5,
};

export function RequestLifecycleStepper({ status }: { status: string }) {
  const t = useT();

  if (status === "rejected" || status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 sm:p-4 text-xs font-semibold text-rose-800 shadow-xs">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shrink-0">
          <IconX className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {status === "rejected" ? t("stepper.rejectedTitle") : t("stepper.cancelledTitle")}
          </p>
          <p className="font-normal text-rose-700 leading-snug">
            {status === "rejected" ? t("stepper.rejectedDesc") : t("stepper.cancelledDesc")}
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = STEP_INDEX[status] ?? 0;
  const isNeedsInfo = status === "needs_info";

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs">
      {/* Мобільний компактний вигляд (< sm) */}
      <div className="sm:hidden space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white shadow-2xs ${
                isNeedsInfo ? "bg-amber-500 ring-2 ring-amber-200" : "bg-[#12325c]"
              }`}
            >
              {isNeedsInfo ? "!" : currentIdx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                {t("stepper.stepOf", { current: currentIdx + 1, total: STEPS.length })}
              </p>
              <p className="text-xs font-extrabold text-[#12325c] truncate mt-0.5 leading-tight">
                {t(`status.${STEPS[currentIdx].key}`)}
              </p>
            </div>
          </div>
          {isNeedsInfo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse shrink-0">
              ⚠️ {t("stepper.waitingClarification")}
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 shrink-0">
              {Math.round(((currentIdx + 1) / STEPS.length) * 100)}%
            </span>
          )}
        </div>

        {/* 6-сегментний прогрес-бар */}
        <div className="grid grid-cols-6 gap-1.5">
          {STEPS.map((step, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={step.key}
                title={t(`status.${step.key}`)}
                className={`h-2 rounded-full transition-all ${
                  isPast
                    ? "bg-[#12325c]"
                    : isCurrent
                      ? isNeedsInfo
                        ? "bg-amber-500 ring-2 ring-amber-200"
                        : "bg-[#12325c] ring-2 ring-blue-200"
                      : "bg-slate-200/80"
                }`}
              />
            );
          })}
        </div>

        {/* Підказка наступного кроку */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
          <span className="truncate">
            {t("common.status")}: <strong className="text-slate-800 font-semibold">{t(`status.${status}`)}</strong>
          </span>
          {currentIdx < STEPS.length - 1 ? (
            <span className="shrink-0 text-slate-500 text-[11px]">
              {t("stepper.next")}: <span className="font-semibold text-slate-700">{t(`status.${STEPS[currentIdx + 1].key}`)}</span>
            </span>
          ) : (
            <span className="shrink-0 text-emerald-600 font-bold text-[11px]">✓ {t("status.completed")}</span>
          )}
        </div>
      </div>

      {/* Десктопний повний степпер (>= sm) */}
      <div className="hidden sm:block">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t("stepper.lifecycle")}
          </span>
          {isNeedsInfo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 animate-pulse">
              {t("stepper.waitingClarification")}
            </span>
          ) : null}
        </div>

        <div className="relative flex items-center justify-between">
          {/* Сполучна лінія */}
          <div className="absolute left-4 right-4 top-4 -translate-y-1/2 h-1 bg-slate-100 -z-0 overflow-hidden rounded-full">
            <div
              className="h-full bg-[#12325c] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, (currentIdx / (STEPS.length - 1)) * 100))}%` }}
            />
          </div>

          {STEPS.map((step, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={step.key}
                className="relative z-10 flex flex-col items-center gap-1.5"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                    isPast
                      ? "bg-[#12325c] text-white"
                      : isCurrent
                        ? isNeedsInfo
                          ? "bg-amber-500 text-white ring-4 ring-amber-100"
                          : "bg-[#12325c] text-white ring-4 ring-blue-100"
                        : "bg-white text-slate-400 border border-slate-200"
                  }`}
                >
                  {isPast ? (
                    <IconCheck className="h-4 w-4" />
                  ) : isCurrent ? (
                    isNeedsInfo ? "!" : idx + 1
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isCurrent
                      ? "font-bold text-slate-900"
                      : isPast
                        ? "font-medium text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {t(`status.${step.key}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
