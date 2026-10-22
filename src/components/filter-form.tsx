"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Клієнтська реактивна фільтрація через Next.js router.push без повного перезавантаження сторінки.
 * Зберігає поточний вигляд (view=kanban / view=table), додає плавний перехід та індикатор оновлення.
 */
export function FilterForm({ action, children }: { action: string; children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const applyFilters = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    const params = new URLSearchParams();

    // Preserve active view (table / kanban)
    const view = searchParams.get("view");
    if (view) params.set("view", view);

    for (const [key, value] of formData.entries()) {
      const str = String(value).trim();
      if (str && str !== "all") {
        params.set(key, str);
      }
    }

    const query = params.toString();
    const url = query ? `${action}?${query}` : action;

    startTransition(() => {
      router.push(url, { scroll: false });
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    applyFilters();
  };

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      onSubmit={handleSubmit}
      className={`grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6 transition-opacity duration-200 ${
        isPending ? "opacity-60 pointer-events-none" : "opacity-100"
      }`}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "SELECT" || target.getAttribute("type") === "date") {
          applyFilters();
        }
      }}
    >
      {children}
    </form>
  );
}
