"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export function startNavigationProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:nav-start"));
  }
}

export function stopNavigationProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:nav-end"));
  }
}

function ProgressWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    stopNavigationProgress();
  }, [pathname, searchParams]);

  return null;
}

export function NavigationProgress() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let finishTimer: NodeJS.Timeout | null = null;

    const onStart = () => {
      if (finishTimer) clearTimeout(finishTimer);
      setLoading(true);
      setProgress(15);

      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) {
            if (timer) clearInterval(timer);
            return prev;
          }
          if (prev < 40) return prev + 15;
          if (prev < 70) return prev + 8;
          return prev + 3;
        });
      }, 180);
    };

    const onEnd = () => {
      if (timer) clearInterval(timer);
      setProgress(100);
      finishTimer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, anchors, new tabs, and modifier keys
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // If clicking the exact same URL without hash change, ignore
      const currentFull = window.location.pathname + window.location.search;
      if (href === currentFull) return;

      onStart();
    };

    window.addEventListener("app:nav-start", onStart);
    window.addEventListener("app:nav-end", onEnd);
    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      if (timer) clearInterval(timer);
      if (finishTimer) clearTimeout(finishTimer);
      window.removeEventListener("app:nav-start", onStart);
      window.removeEventListener("app:nav-end", onEnd);
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  if (!loading && progress === 0) {
    return (
      <Suspense fallback={null}>
        <ProgressWatcher />
      </Suspense>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <ProgressWatcher />
      </Suspense>

      {/* Top progress line */}
      <div
        className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-[3px] bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(37,99,235,0.8)] transition-all duration-200 ease-out"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
            transitionProperty: "width, opacity",
          }}
        />
      </div>

      {/* Subtle floating badge in top right corner on slow requests */}
      {loading && progress > 20 ? (
        <div
          className="pointer-events-none fixed top-3 right-4 z-[99998] flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-md backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
          role="status"
          aria-live="polite"
        >
          <svg
            className="h-3.5 w-3.5 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Завантаження...</span>
        </div>
      ) : null}
    </>
  );
}
