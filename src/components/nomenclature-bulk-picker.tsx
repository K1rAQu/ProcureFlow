"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input } from "./ui";
import { IconBox, IconCheck, IconPlus, IconSearch, IconX } from "./icons";
import { cn } from "@/lib/format";
import { useLocale, useT } from "./i18n-provider";

export type BulkItemPayload = {
  nomenclatureId: number;
  name: string;
  partNumber: string;
  manufacturer: string;
  unit: string;
  url: string;
  quantity: string;
  imageId: number | null;
};

type NomenclatureItem = {
  id: number;
  name: string;
  partNumber: string | null;
  basCode: string | null;
  manufacturer: string | null;
  url: string | null;
  unit: string;
  status: string;
  lastPrice: string | null;
  lastCurrency: string | null;
  usageCount: number;
  imageId: number | null;
};

export function NomenclatureBulkPicker({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: BulkItemPayload[]) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const defaultUnit = locale === "en" ? "pcs" : "шт";
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NomenclatureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Map<number, { item: NomenclatureItem; quantity: string }>>(
    new Map(),
  );

  // При відкритті скидаємо пошук або вибір, якщо потрібно
  useEffect(() => {
    if (!open) return;
    setSelectedMap(new Map());
    setQuery("");
  }, [open]);

  // Завантаження позицій номенклатури при зміні вкладки чи пошуку
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "60",
          mine: tab === "mine" ? "1" : "0",
          sort: "usage",
        });
        if (query.trim()) params.set("q", query.trim());

        const res = await fetch(`/api/nomenclature?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { items: NomenclatureItem[] };
          setItems(data.items ?? []);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, tab, query]);

  if (!open) return null;

  function toggleItem(item: NomenclatureItem) {
    setSelectedMap((current) => {
      const next = new Map(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, quantity: "1" });
      }
      return next;
    });
  }

  function setQuantity(id: number, qtyStr: string) {
    setSelectedMap((current) => {
      const existing = current.get(id);
      if (!existing) return current;
      const next = new Map(current);
      next.set(id, { ...existing, quantity: qtyStr });
      return next;
    });
  }

  function stepQuantity(id: number, delta: number) {
    setSelectedMap((current) => {
      const existing = current.get(id);
      if (!existing) return current;
      const currentVal = Number(existing.quantity.replace(",", ".")) || 1;
      const nextVal = Math.max(1, Math.round((currentVal + delta) * 100) / 100);
      const next = new Map(current);
      next.set(id, { ...existing, quantity: String(nextVal) });
      return next;
    });
  }

  function handleConfirm() {
    const payloads: BulkItemPayload[] = [];
    for (const { item, quantity } of selectedMap.values()) {
      payloads.push({
        nomenclatureId: item.id,
        name: item.name,
        partNumber: item.partNumber ?? "",
        manufacturer: item.manufacturer ?? "",
        unit: item.unit || defaultUnit,
        url: item.url ?? "",
        quantity: quantity.trim() ? quantity : "1",
        imageId: item.imageId,
      });
    }
    if (payloads.length > 0) {
      onAdd(payloads);
    }
    onClose();
  }

  const selectedCount = selectedMap.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#12325c] text-white">
                <IconBox className="h-4 w-4" />
              </span>
              <span>{t("nom.bulkTitle")}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("nom.bulkDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 transition"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Tabs & Search */}
        <div className="border-b border-slate-200 px-6 py-3.5 space-y-3 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setTab("mine")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  tab === "mine"
                    ? "bg-white text-[#12325c] shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {t("nom.bulkMine")}
              </button>
              <button
                type="button"
                onClick={() => setTab("all")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  tab === "all"
                    ? "bg-white text-[#12325c] shadow-xs"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {t("nom.bulkAll")}
              </button>
            </div>

            {/* Selected Count Indicator */}
            {selectedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                <IconCheck className="h-3.5 w-3.5" />
                {t("nom.bulkSelected", { count: selectedCount })}
              </span>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("nom.searchPlaceholder")}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#12325c] focus:outline-none focus:ring-1 focus:ring-[#12325c]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100 min-h-[300px]">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="mt-2 font-medium">{t("nom.bulkLoading")}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <IconBox className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {query.trim()
                  ? t("nom.bulkNoneFound", { query })
                  : tab === "mine"
                    ? t("nom.bulkMineEmpty")
                    : t("nom.bulkCatalogEmpty")}
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {tab === "mine" && !query.trim() ? (
                  <>
                    {t("nom.bulkViewAllHint")}{" "}
                    <button
                      type="button"
                      onClick={() => setTab("all")}
                      className="font-bold text-indigo-600 underline hover:text-indigo-800"
                    >
                      {t("nom.bulkAll")}
                    </button>
                  </>
                ) : (
                  t("nom.bulkChangeQuery")
                )}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedMap.has(item.id);
              const selectedData = selectedMap.get(item.id);
              const quantity = selectedData?.quantity ?? "1";

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl transition cursor-pointer my-1 border",
                    isSelected
                      ? "border-indigo-300 bg-indigo-50/70 shadow-xs"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                  )}
                >
                  {/* Left part: Checkbox + Photo + Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white",
                      )}
                    >
                      {isSelected && <IconCheck className="h-3.5 w-3.5" />}
                    </div>

                    {/* Image Thumbnail */}
                    {item.imageId ? (
                      <img
                        src={`/api/files/${item.imageId}`}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover bg-white"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                        <IconBox className="h-5 w-5" />
                      </div>
                    )}

                    {/* Item Text & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{item.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.partNumber && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                            {t("item.partNumberShort")}: {item.partNumber}
                          </span>
                        )}
                        {item.basCode && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                            1C: {item.basCode}
                          </span>
                        )}
                        {item.manufacturer && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            {item.manufacturer}
                          </span>
                        )}
                        {item.lastPrice && (
                          <span className="text-[10px] text-slate-500">
                            ~{item.lastPrice} {item.lastCurrency || (locale === "uk" ? "грн" : "UAH")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right part: Quantity Stepper & Unit */}
                  <div
                    className="flex items-center justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isSelected ? (
                      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200 shadow-xs">
                        <button
                          type="button"
                          onClick={() => stepQuantity(item.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95"
                          title={t("item.decreaseQty")}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={quantity}
                          onChange={(e) => setQuantity(item.id, e.target.value)}
                          className="h-7 w-16 text-center text-xs font-bold text-slate-900 border-0 focus:outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() => stepQuantity(item.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95"
                          title={t("item.increaseQty")}
                        >
                          +
                        </button>
                        <span className="px-1.5 text-xs font-semibold text-slate-500">
                          {item.unit || defaultUnit}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition"
                      >
                        <IconPlus className="h-3.5 w-3.5" />
                        <span>{t("common.add")} ({item.unit || defaultUnit})</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-3">
            {selectedCount > 0 ? (
              <>
                <span className="text-xs font-semibold text-slate-700">
                  {t("nom.bulkSelected", { count: selectedCount })}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMap(new Map())}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  {t("nom.bulkClear")}
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">
                {t("nom.bulkDesc")}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={selectedCount === 0}
              onClick={handleConfirm}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {t("nom.bulkAdd", { count: selectedCount })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
