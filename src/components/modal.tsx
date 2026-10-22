"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { IconX } from "./icons";

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop with smooth blur */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={cn(
          "relative w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all animate-in fade-in zoom-in-95 duration-200 overflow-hidden",
          maxWidth,
          className,
        )}
      >
        {title || description ? (
          <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
            <div>
              {title ? <h3 className="text-base font-bold text-slate-900">{title}</h3> : null}
              {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Закрити"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div className="p-6">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
