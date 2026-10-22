"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "./ui";
import { useT } from "./i18n-provider";

export function ExportCsvButton({
  endpoint,
  defaultParams = {},
  label,
}: {
  endpoint: string;
  defaultParams?: Record<string, string>;
  label?: string;
}) {
  const t = useT();
  const searchParams = useSearchParams();

  function handleExport() {
    const params = new URLSearchParams(searchParams?.toString() || "");
    for (const [k, v] of Object.entries(defaultParams)) {
      if (!params.has(k)) {
        params.set(k, v);
      }
    }
    const url = `${endpoint}?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="flex items-center gap-1.5 border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
      title="Завантажити звіт у форматі CSV для Microsoft Excel"
    >
      <span className="text-emerald-700 font-bold">📊</span>
      <span>{label || t("common.exportCsv")}</span>
    </Button>
  );
}
