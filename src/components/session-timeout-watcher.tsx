"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "procurement_last_active";

export function SessionTimeoutWatcher({ timeoutMinutes }: { timeoutMinutes: number }) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const isLoggingOut = useRef(false);

  useEffect(() => {
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const recordActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {

      }
    };

    recordActivity();

    let lastRecord = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();

      if (now - lastRecord > 10000) {
        lastRecord = now;
        recordActivity();
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll", "pointerdown"];
    for (const evt of events) {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    }

    const interval = setInterval(async () => {
      if (isLoggingOut.current) return;
      try {
        const stored = Number(localStorage.getItem(STORAGE_KEY) || Date.now());
        const idleTime = Date.now() - stored;
        if (idleTime >= timeoutMs) {
          isLoggingOut.current = true;
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {

          }
          window.location.href = "/login?reason=timeout";
        }
      } catch {

      }
    }, 15000);

    return () => {
      clearInterval(interval);
      for (const evt of events) {
        window.removeEventListener(evt, handleUserActivity);
      }
    };
  }, [timeoutMinutes, timeoutMs]);

  return null;
}
