"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./ui";
import { IconAlertTriangle, IconHelpCircle, IconTrash, IconX } from "./icons";

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "primary" | "warning";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue>(() => Promise.resolve(false));

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { isOpen: boolean }) | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ ...options, isOpen: true });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setDialog((prev) => (prev ? { ...prev, isOpen: false } : null));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  // Keyboard navigation: Escape cancels, Enter confirms
  useEffect(() => {
    if (!dialog?.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose(false);
      } else if (event.key === "Enter" && !event.shiftKey) {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag !== "textarea") {
          event.preventDefault();
          handleClose(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [dialog?.isOpen, handleClose]);

  const tone = dialog?.tone ?? "primary";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialog?.isOpen ? (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          {/* Backdrop with smooth blur */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => handleClose(false)}
            aria-hidden="true"
          />

          {/* Dialog Card */}
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    tone === "danger"
                      ? "bg-rose-100 text-rose-600 ring-4 ring-rose-50"
                      : tone === "warning"
                        ? "bg-amber-100 text-amber-700 ring-4 ring-amber-50"
                        : "bg-indigo-100 text-[#12325c] ring-4 ring-indigo-50"
                  }`}
                >
                  {tone === "danger" ? (
                    <IconTrash className="h-5 w-5" />
                  ) : tone === "warning" ? (
                    <IconAlertTriangle className="h-5 w-5" />
                  ) : (
                    <IconHelpCircle className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">
                    {dialog.title ?? (tone === "danger" ? "Підтвердження дії" : "Підтвердження")}
                  </h3>
                  <div className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {dialog.message}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  title="Закрити"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleClose(false)}
                className="font-medium"
              >
                {dialog.cancelText ?? "Скасувати"}
              </Button>
              <Button
                type="button"
                variant={tone === "danger" ? "danger" : "primary"}
                size="sm"
                autoFocus
                onClick={() => handleClose(true)}
                className="font-semibold shadow-xs"
              >
                {dialog.confirmText ?? (tone === "danger" ? "Видалити" : "Підтвердити")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
