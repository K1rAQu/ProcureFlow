"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Автоматично оновлює дані сторінки (Next.js router.refresh):
 * 1) при поверненні користувача на вкладку браузера (window focus)
 * 2) періодично у фоні кожні intervalSeconds, коли вкладка активна
 */
export function AutoRefresher({ intervalSeconds = 20 }: { intervalSeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const handleFocus = () => {
      router.refresh();
    };

    window.addEventListener("focus", handleFocus);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalSeconds * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(timer);
    };
  }, [router, intervalSeconds]);

  return null;
}
