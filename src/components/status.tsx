"use client";

import { cn } from "@/lib/format";
import { useT } from "./i18n-provider";

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; ring: string; dot: string }
> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-300/60",
    dot: "bg-slate-400",
  },
  submitted: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-300/70",
    dot: "bg-blue-500",
  },
  in_review: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    ring: "ring-indigo-300/70",
    dot: "bg-indigo-500",
  },
  needs_info: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    ring: "ring-amber-300/80",
    dot: "bg-amber-500 animate-pulse",
  },
  purchasing: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    ring: "ring-teal-300/70",
    dot: "bg-teal-500",
  },
  ordered: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    ring: "ring-purple-300/70",
    dot: "bg-purple-500",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-300/70",
    dot: "bg-emerald-500",
  },
  rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    ring: "ring-rose-300/70",
    dot: "bg-rose-500",
  },
  cancelled: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    ring: "ring-slate-200",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useT();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap shadow-xs",
        cfg.bg,
        cfg.text,
        cfg.ring,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const t = useT();

  if (priority === "urgent") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-inset ring-rose-300 whitespace-nowrap shadow-xs",
          className,
        )}
      >
        <span aria-hidden="true">🔥</span>
        {t("priority.urgent")}
      </span>
    );
  }

  if (priority === "high") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-300 whitespace-nowrap",
          className,
        )}
      >
        <span aria-hidden="true">▲</span>
        {t("priority.high")}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center text-xs text-slate-400 whitespace-nowrap", className)}>
      {t("priority.normal")}
    </span>
  );
}

export function NomenclatureStatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useT();
  const tone =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-300/70"
      : status === "pending"
        ? "bg-amber-50 text-amber-800 ring-amber-300/80"
        : status === "merged"
          ? "bg-violet-50 text-violet-700 ring-violet-300/70"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        tone,
        className,
      )}
    >
      {t(`nom.status.${status}`)}
    </span>
  );
}
