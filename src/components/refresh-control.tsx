"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./i18n-provider";
import { cn } from "@/lib/format";

export function RefreshControl({ className }: { className?: string }) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const retryCount = useRef(0);
  const maxRetries = 3;

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
      setHasNewUpdates(false);
    });
  }

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    let eventSource: EventSource | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    function connect() {
      try {
        eventSource = new EventSource("/api/realtime");

        eventSource.onopen = () => {
          setIsLive(true);
          retryCount.current = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            if (!event.data || event.data.trim() === "ping") return;
            const payload = JSON.parse(event.data);
            if (payload.type === "connected") return;
            if (payload.entityType === "request" || payload.action?.startsWith("request.")) {
              setHasNewUpdates(true);
            }
          } catch {}
        };

        eventSource.onerror = () => {
          setIsLive(false);
          eventSource?.close();
          eventSource = null;

          // Graceful backoff: retry up to maxRetries times, then degrade to manual refresh
          if (retryCount.current < maxRetries) {
            const delay = (retryCount.current + 1) * 10000;
            retryCount.current += 1;
            retryTimer = setTimeout(connect, delay);
          }
        };
      } catch {
        setIsLive(false);
      }
    }

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSource) eventSource.close();
    };
  }, []);

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        title={isLive ? t("common.live") : undefined}
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer shadow-2xs",
          hasNewUpdates
            ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 ring-2 ring-amber-300/40"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
          isPending && "opacity-75 cursor-wait",
        )}
      >
        <span
          className={cn(
            "text-sm leading-none transition-transform duration-300",
            isPending && "animate-spin",
          )}
        >
          ↻
        </span>
        <span>{isPending ? t("common.refreshing") : t("common.refresh")}</span>

        {/* Live indicator dot */}
        {isLive && !hasNewUpdates ? (
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            title={t("common.live")}
          />
        ) : null}

        {/* New updates badge */}
        {hasNewUpdates ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
            {t("common.newUpdates")}
          </span>
        ) : null}
      </button>
    </div>
  );
}
