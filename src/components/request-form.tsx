"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import {
  IconArrowDown,
  IconArrowUp,
  IconBox,
  IconCheck,
  IconClock,
  IconCopy,
  IconPaperclip,
  IconPlus,
  IconSave,
  IconSearch,
  IconSend,
  IconTrash,
  IconX,
} from "./icons";
import { useLocalizedName, useT } from "./i18n-provider";
import { useConfirm } from "./confirm-provider";
import { NomenclatureBulkPicker, type BulkItemPayload } from "./nomenclature-bulk-picker";
import { PRIORITIES } from "@/lib/workflow";
import { cn } from "@/lib/format";
import { compressImage } from "@/lib/client-image";

export type DirectoryOption = { id: number; nameRu: string; nameUk: string };

export type ItemImage = { id: number; url: string; name: string };

export type ItemDraft = {
  key: string;
  nomenclatureId: number | null;
  name: string;
  partNumber: string;
  manufacturer: string;
  quantity: string;
  unit: string;
  url: string;
  comment: string;
  images: ItemImage[];
  updateNomenclatureCard: boolean;
  confirmNewNomenclature: boolean;
};

type DuplicateMatch = {
  id: number;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  score: number;
  reason: string;
};

type SearchHit = {
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
  imageId: number | null;
};

export type RequestFormInitial = {
  id?: number;
  departmentId?: number | null;
  workshopId?: number | null;
  priority?: string;
  desiredDate?: string | null;
  comment?: string | null;
  items?: ItemDraft[];
};

let itemKeySeed = 0;

function emptyItem(): ItemDraft {
  itemKeySeed += 1;
  return {
    key: `row-${itemKeySeed}`,
    nomenclatureId: null,
    name: "",
    partNumber: "",
    manufacturer: "",
    quantity: "1",
    unit: "шт",
    url: "",
    comment: "",
    images: [],
    updateNomenclatureCard: false,
    confirmNewNomenclature: false,
  };
}

const DRAFT_STORAGE_KEY = "procurement:request-draft:v1";

export function RequestForm({
  departments,
  workshops,
  units = [],
  initial,
  mode = "create",
  requiredFields = [],
  copiedFromNumber,
}: {
  departments: DirectoryOption[];
  workshops: DirectoryOption[];
  units?: { id: number; name: string; description?: string | null }[];
  initial?: RequestFormInitial;
  mode?: "create" | "edit";
  requiredFields?: string[];
  copiedFromNumber?: string | null;
}) {
  const t = useT();
  const confirm = useConfirm();
  const localized = useLocalizedName();
  const router = useRouter();

  const [departmentId, setDepartmentId] = useState<string>(initial?.departmentId ? String(initial.departmentId) : "");
  const [workshopId, setWorkshopId] = useState<string>(initial?.workshopId ? String(initial.workshopId) : "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "normal");
  const [comment, setComment] = useState<string>(initial?.comment ?? "");
  const [items, setItems] = useState<ItemDraft[]>(initial?.items?.length ? initial.items : [emptyItem()]);

  const [conflicts, setConflicts] = useState<Record<number, DuplicateMatch[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  function submissionKey(): string {
    if (!idempotencyKey.current) {
      idempotencyKey.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return idempotencyKey.current;
  }

  /* ---------------- Автозбереження чернетки ---------------- */
  useEffect(() => {
    if (mode !== "create" || copiedFromNumber) return;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;
    const timer = setTimeout(() => {
      try {
        const parsed = JSON.parse(raw) as RequestFormInitial & { items: ItemDraft[] };
        if (!parsed.items?.length) return;
        setDepartmentId(parsed.departmentId ? String(parsed.departmentId) : "");
        setWorkshopId(parsed.workshopId ? String(parsed.workshopId) : "");
        setPriority(parsed.priority ?? "normal");
        setComment(parsed.comment ?? "");
        setItems(parsed.items);
        setRestored(true);
      } catch {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, copiedFromNumber]);

  useEffect(() => {
    if (mode !== "create" || !dirty) return;
    const timer = setTimeout(() => {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ departmentId, workshopId, priority, comment, items }),
      );
      const now = new Date();
      setSavedAt(
        now.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [mode, dirty, departmentId, workshopId, priority, comment, items]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patchItem = useCallback((index: number, patch: Partial<ItemDraft>) => {
    setDirty(true);
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }, []);

  const handleBulkAdd = useCallback((selected: BulkItemPayload[]) => {
    if (!selected.length) return;
    setDirty(true);
    setItems((current) => {
      itemKeySeed += 1;
      const newDrafts: ItemDraft[] = selected.map((s, idx) => ({
        key: `bulk-${itemKeySeed}-${idx}`,
        nomenclatureId: s.nomenclatureId,
        name: s.name,
        partNumber: s.partNumber,
        manufacturer: s.manufacturer,
        quantity: s.quantity,
        unit: s.unit || "шт",
        url: s.url,
        comment: "",
        images: s.imageId ? [{ id: s.imageId, url: `/api/files/${s.imageId}`, name: "" }] : [],
        updateNomenclatureCard: false,
        confirmNewNomenclature: false,
      }));

      // Якщо поточний список містить лише 1 порожню позицію (за замовчуванням), замінюємо її
      if (current.length === 1 && !current[0].name.trim() && !current[0].partNumber.trim()) {
        return newDrafts;
      }
      return [...current, ...newDrafts];
    });
  }, []);

  const duplicateItem = useCallback((index: number) => {
    setDirty(true);
    setItems((current) => {
      const source = current[index];
      if (!source) return current;
      itemKeySeed += 1;
      const clone: ItemDraft = {
        ...source,
        key: `row-${itemKeySeed}`,
        images: [...source.images],
      };
      const next = [...current];
      next.splice(index + 1, 0, clone);
      return next;
    });
  }, []);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!departmentId) errors.departmentId = t("common.required");
    if (!workshopId) errors.workshopId = t("common.required");
    items.forEach((item, index) => {
      if (!item.name.trim() || item.name.trim().length < 2) errors[`name-${index}`] = t("common.required");
      const quantity = Number(item.quantity.replace(",", "."));
      if (!Number.isFinite(quantity) || quantity <= 0) errors[`quantity-${index}`] = t("common.required");
      for (const field of requiredFields) {
        if (field === "partNumber" && !item.partNumber.trim()) errors[`partNumber-${index}`] = t("common.required");
        if (field === "url" && !item.url.trim()) errors[`url-${index}`] = t("common.required");
        if (field === "photo" && !item.images.length) errors[`photo-${index}`] = t("common.required");
      }
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Будь ласка, заповніть усі обов'язкові поля, виділені червоним");
      const firstError = document.querySelector(".border-rose-400, .text-rose-600");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  async function submit(shouldSubmit: boolean) {
    if (busy) return;
    setError(null);
    if (!validate()) return;
    setBusy(true);

    const payload = {
      departmentId: Number(departmentId),
      workshopId: Number(workshopId),
      priority,
      desiredDate: null,
      comment: comment || null,
      submit: shouldSubmit,
      idempotencyKey: submissionKey(),
      items: items.map((item) => ({
        nomenclatureId: item.nomenclatureId,
        name: item.name.trim(),
        partNumber: item.partNumber || null,
        manufacturer: item.manufacturer || null,
        quantity: item.quantity,
        unit: item.unit || "шт",
        unitPrice: null,
        currency: null,
        url: item.url || null,
        comment: item.comment || null,
        fileIds: item.images.map((image) => image.id),
        updateNomenclatureCard: item.updateNomenclatureCard,
        confirmNewNomenclature: item.confirmNewNomenclature,
      })),
    };

    const endpoint = mode === "edit" && initial?.id ? `/api/requests/${initial.id}` : "/api/requests";
    const response = await fetch(endpoint, {
      method: mode === "edit" && initial?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as { id: number };
      if (mode === "create") window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDirty(false);
      router.push(`/requests/${data.id}`);
      return;
    }

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: { conflicts?: { index: number; name: string; candidates: DuplicateMatch[] }[] };
    };

    if (data.details?.conflicts) {
      const map: Record<number, DuplicateMatch[]> = {};
      for (const conflict of data.details.conflicts) {
        map[conflict.index] = conflict.candidates;
      }
      setConflicts(map);
      setError(t("request.duplicateConflict"));
    } else {
      setError(t("error.generic"));
    }
    setBusy(false);
  }

  const hasDirectories = departments.length > 0 && workshops.length > 0;

  return (
    <div className="space-y-6 pb-28">
      {copiedFromNumber ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 text-indigo-950 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <IconCopy className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-indigo-950">Створення на основі заявки {copiedFromNumber}</div>
              <div className="text-xs text-indigo-700">
                Підрозділ, цех, пріоритет та всі {items.length} поз. скопійовано. Ви можете скоригувати кількість, додати чи видалити позиції перед відправкою.
              </div>
            </div>
          </div>
          <Link
            href="/requests/new"
            className="inline-flex shrink-0 items-center justify-center text-xs font-semibold text-indigo-700 underline hover:text-indigo-900"
          >
            Очистити й створити з нуля
          </Link>
        </div>
      ) : null}

      {restored ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-300">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">💡</span>
            {t("request.draftRestored")}
          </span>
          <button
            type="button"
            className="font-medium underline hover:text-amber-950"
            onClick={() => {
              window.localStorage.removeItem(DRAFT_STORAGE_KEY);
              setRestored(false);
            }}
          >
            Скинути
          </button>
        </div>
      ) : null}

      {!hasDirectories ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 ring-1 ring-rose-300">
          {departments.length === 0 ? t("error.noDepartments") : t("error.noWorkshops")}
        </div>
      ) : null}

      {/* Блок 1: Загальна інформація про заявку */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#12325c] text-xs font-bold text-white">
                1
              </span>
              <span>Основні параметри</span>
            </span>
          }
          description="Вкажіть підрозділ, пріоритетність та бажані терміни поставки"
          actions={
            savedAt ? (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <IconClock className="h-3.5 w-3.5 text-emerald-600" />
                Автозбережено о {savedAt}
              </span>
            ) : null
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("request.department")} required error={fieldErrors.departmentId}>
            <Select
              value={departmentId}
              onChange={(event) => {
                setDirty(true);
                setDepartmentId(event.target.value);
              }}
            >
              <option value="">— Оберіть напрям —</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {localized(department)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("request.workshop")} required error={fieldErrors.workshopId}>
            <Select
              value={workshopId}
              onChange={(event) => {
                setDirty(true);
                setWorkshopId(event.target.value);
              }}
            >
              <option value="">— Оберіть цех / ділянку —</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {localized(workshop)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("request.priority")}>
            <Select
              value={priority}
              onChange={(event) => {
                setDirty(true);
                setPriority(event.target.value);
              }}
            >
              {PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {t(`priority.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("request.comment")} className="sm:col-span-2 lg:col-span-3" hint="Додаткова інформація для відділу постачання">
            <Textarea
              value={comment ?? ""}
              rows={2}
              placeholder="Наприклад: потрібно для планового ремонту, доставка на центральний склад"
              onChange={(event) => {
                setDirty(true);
                setComment(event.target.value);
              }}
            />
          </Field>
        </div>
      </Card>

      {/* Блок 2: Позиції заявки */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#12325c] text-xs font-bold text-white">
                2
              </span>
              <span>Позиції до закупівлі ({items.length})</span>
            </span>
          }
          description="Шукайте позиції за назвою або артикулом. Код БАС підтягується автоматично."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBulkPickerOpen(true)}
                className="border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 font-semibold"
              >
                <IconBox className="h-3.5 w-3.5" /> Додати з номенклатури
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDirty(true);
                  setItems((current) => [...current, emptyItem()]);
                }}
              >
                <IconPlus className="h-3.5 w-3.5" /> {t("request.addItem")}
              </Button>
            </div>
          }
        />
        <div className="divide-y divide-slate-200">
          {items.map((item, index) => (
            <ItemRow
              key={item.key}
              index={index}
              item={item}
              total={items.length}
              availableUnits={units}
              duplicates={conflicts[index] ?? []}
              errors={fieldErrors}
              requiredFields={requiredFields}
              onPatch={(patch) => patchItem(index, patch)}
              onDuplicate={() => duplicateItem(index)}
              onRemove={() => {
                setDirty(true);
                setItems((current) =>
                  current.length === 1 ? [emptyItem()] : current.filter((_, position) => position !== index),
                );
                setConflicts({});
              }}
              onMove={(direction) => {
                setDirty(true);
                setItems((current) => {
                  const next = [...current];
                  const target = index + direction;
                  if (target < 0 || target >= next.length) return current;
                  [next[index], next[target]] = [next[target], next[index]];
                  return next;
                });
                setConflicts({});
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDirty(true);
              setItems((current) => [...current, emptyItem()]);
            }}
          >
            <IconPlus className="h-4 w-4" /> Додати ще одну позицію
          </Button>
          <div className="text-right text-xs text-slate-500">
            Всього позицій: <span className="font-semibold text-slate-800">{items.length}</span>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* Закріплена панель дій внизу сторінки */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-300/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-500">
              Позицій: <span className="font-semibold text-slate-800">{items.length}</span>
            </div>
            {savedAt ? (
              <>
                <div className="h-4 w-px bg-slate-300" />
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <IconCheck className="h-3.5 w-3.5" /> Чернетка збережена о {savedAt}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="primary"
                disabled={busy || !hasDirectories}
                onClick={() => submit(false)}
              >
                <IconSave className="h-4 w-4" />
                {busy ? t("common.saving") : "Зберегти зміни"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !hasDirectories}
                  onClick={() => submit(false)}
                >
                  <IconSave className="h-4 w-4" />
                  {t("request.saveDraft")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || !hasDirectories}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Подання заявки",
                      message: t("request.submitConfirm"),
                      confirmText: t("request.submit"),
                      cancelText: t("common.back"),
                      tone: "primary",
                    });
                    if (ok) void submit(true);
                  }}
                >
                  <IconSend className="h-4 w-4" />
                  {busy ? t("common.saving") : t("request.submit")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <NomenclatureBulkPicker
        open={bulkPickerOpen}
        onClose={() => setBulkPickerOpen(false)}
        onAdd={handleBulkAdd}
      />
    </div>
  );
}

const COMMON_UNITS = ["шт", "м", "компл", "кг", "л", "пач"];

function ItemRow({
  index,
  item,
  total,
  availableUnits = [],
  duplicates,
  errors,
  requiredFields,
  onPatch,
  onDuplicate,
  onRemove,
  onMove,
}: {
  index: number;
  item: ItemDraft;
  total: number;
  availableUnits?: { id: number; name: string; description?: string | null }[];
  duplicates: DuplicateMatch[];
  errors: Record<string, string>;
  requiredFields: string[];
  onPatch: (patch: Partial<ItemDraft>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: number) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proactiveDuplicates, setProactiveDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  useEffect(() => {
    if (item.nomenclatureId || item.name.trim().length < 3) {
      setProactiveDuplicates([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const response = await fetch("/api/nomenclature/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name.trim(),
            partNumber: item.partNumber.trim() || undefined,
          }),
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { duplicates?: DuplicateMatch[] };
          setProactiveDuplicates(data.duplicates ?? []);
        }
      } catch {
        /* aborted or network issue */
      } finally {
        setCheckingDuplicates(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [item.name, item.partNumber, item.nomenclatureId]);

  const activeDuplicates = duplicates.length > 0 ? duplicates : proactiveDuplicates;

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/nomenclature?q=${encodeURIComponent(query.trim())}&limit=8`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { items: SearchHit[] };
          setHits(data.items);
        }
      } catch {
        /* скасований запит */
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  function applyHit(hit: SearchHit) {
    onPatch({
      nomenclatureId: hit.id,
      name: hit.name,
      partNumber: hit.partNumber ?? "",
      manufacturer: hit.manufacturer ?? "",
      unit: hit.unit || "шт",
      url: hit.url ?? "",
      confirmNewNomenclature: false,
      images:
        hit.imageId && !item.images.length
          ? [{ id: hit.imageId, url: `/api/files/${hit.imageId}`, name: "" }]
          : item.images,
    });
    setOpen(false);
    setQuery("");
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    setUploadError(null);
    const uploaded: ItemImage[] = [];
    for (const rawFile of Array.from(fileList).slice(0, 4)) {
      const file = await compressImage(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: formData });
      if (response.ok) {
        const data = (await response.json()) as ItemImage;
        uploaded.push(data);
      } else {
        const data = (await response.json().catch(() => ({ error: "error" }))) as { error: string };
        setUploadError(data.error === "file_too_large" ? t("error.fileSize") : t("error.fileType"));
      }
    }
    if (uploaded.length) onPatch({ images: [...item.images, ...uploaded].slice(0, 8) });
    setUploading(false);
  }

  return (
    <div className="p-5 transition hover:bg-slate-50/40">
      {/* Рядок заголовку позиції з швидкими діями */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-800 text-xs font-bold text-white">
            #{index + 1}
          </span>
          {item.nomenclatureId ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300">
              <span>✓ З номенклатури #{item.nomenclatureId}</span>
              <button
                type="button"
                className="ml-0.5 rounded text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
                onClick={() => onPatch({ nomenclatureId: null, updateNomenclatureCard: false })}
                title={t("item.unlink")}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Нова позиція
            </span>
          )}
          {item.name ? (
            <span className="max-w-md truncate text-xs font-semibold text-slate-800">
              {item.name}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            title="Дублювати позицію"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <IconCopy className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Дублювати</span>
          </button>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title={t("item.moveUp")}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
          >
            <IconArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title={t("item.moveDown")}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
          >
            <IconArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={t("item.remove")}
            className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-12">
        {/* Поле назви з автокомплітом */}
        <div className="relative lg:col-span-6">
          <Field
            label={t("item.name")}
            required
            error={errors[`name-${index}`]}
            hint="Почніть вводити для пошуку в довіднику номенклатури"
          >
            <div className="relative">
              <Input
                value={item.name}
                placeholder="Наприклад: Підшипник кульковий SKF 6204 2RS"
                autoComplete="off"
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 220)}
                onChange={(event) => {
                  onPatch({ name: event.target.value, nomenclatureId: null, confirmNewNomenclature: false });
                  setQuery(event.target.value);
                  setOpen(true);
                }}
              />
              <span className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400">
                <IconSearch className="h-4 w-4" />
              </span>
            </div>
          </Field>

          {/* Випадаючий список пошукових підказок */}
          {open && (hits.length > 0 || searching) ? (
            <div className="animate-fade-in absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-xl">
              {searching && hits.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  Пошук у номенклатурі...
                </div>
              ) : null}
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyHit(hit)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 p-2.5 text-left transition last:border-b-0 hover:bg-slate-50"
                >
                  {hit.imageId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${hit.imageId}`}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400">
                      IMG
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{hit.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {hit.basCode ? (
                        <span className="rounded bg-sky-50 px-1 font-mono font-medium text-sky-700">
                          БАС: {hit.basCode}
                        </span>
                      ) : null}
                      {hit.partNumber ? (
                        <span className="font-mono text-slate-600">{hit.partNumber}</span>
                      ) : null}
                      {hit.manufacturer ? <span>· {hit.manufacturer}</span> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Артикул */}
        <Field
          label={t("item.partNumber")}
          required={requiredFields.includes("partNumber")}
          error={errors[`partNumber-${index}`]}
          className="lg:col-span-3"
        >
          <Input
            value={item.partNumber}
            placeholder="Артикул виробника"
            onChange={(event) => onPatch({ partNumber: event.target.value })}
            autoComplete="off"
          />
        </Field>

        {/* Виробник */}
        <Field label={t("nom.manufacturer")} className="lg:col-span-3">
          <Input
            value={item.manufacturer}
            placeholder="Бренд / Завод"
            onChange={(event) => onPatch({ manufacturer: event.target.value })}
          />
        </Field>

        {/* Кількість */}
        <div className="lg:col-span-2">
          <Field label={t("item.quantity")} required error={errors[`quantity-${index}`]}>
            <Input
              inputMode="decimal"
              value={item.quantity}
              onChange={(event) => onPatch({ quantity: event.target.value })}
            />
          </Field>
        </div>

        {/* Одиниця виміру + швидкі кнопки */}
        <div className="lg:col-span-4">
          <Field label={t("item.unit")} hint="Оберіть або введіть">
            <Input
              value={item.unit}
              placeholder="шт"
              onChange={(event) => onPatch({ unit: event.target.value })}
            />
          </Field>
          <div className="mt-1 flex flex-wrap gap-1">
            {(availableUnits.length > 0
              ? availableUnits.map((u) => ({ name: u.name, description: u.description }))
              : COMMON_UNITS.map((u) => ({ name: u, description: null }))
            ).map((unit) => (
              <button
                key={unit.name}
                type="button"
                title={unit.description ?? undefined}
                onClick={() => onPatch({ unit: unit.name })}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition",
                  item.unit === unit.name
                    ? "bg-[#12325c] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {unit.name}
              </button>
            ))}
          </div>
        </div>

        {/* Посилання */}
        <Field
          label={t("item.url")}
          required={requiredFields.includes("url")}
          error={errors[`url-${index}`]}
          className="lg:col-span-6"
        >
          <Input
            type="url"
            placeholder="https://example.com/item/123"
            value={item.url}
            onChange={(event) => onPatch({ url: event.target.value })}
          />
        </Field>

        {/* Коментар до позиції */}
        <Field label={t("item.comment")} className="lg:col-span-12">
          <Input
            value={item.comment}
            placeholder="Уточнення розміру, кольору або аналогів (необов'язково)"
            onChange={(event) => onPatch({ comment: event.target.value })}
          />
        </Field>
      </div>

      {/* Фотографії та файли */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#12325c] hover:bg-slate-50">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <IconPaperclip className="h-3.5 w-3.5 text-slate-500" />
          <span>{t("item.photo")}</span>
          {requiredFields.includes("photo") ? <span className="text-rose-600">*</span> : null}
        </label>
        {uploading ? (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            {t("common.loading")}
          </span>
        ) : null}
        {uploadError ? <span className="text-xs text-rose-600 font-medium">{uploadError}</span> : null}
        {errors[`photo-${index}`] ? <span className="text-xs text-rose-600">{errors[`photo-${index}`]}</span> : null}

        {item.images.map((image) => (
          <span key={image.id} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={image.name} className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" />
            <button
              type="button"
              onClick={() => onPatch({ images: item.images.filter((candidate) => candidate.id !== image.id) })}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white shadow-xs transition hover:bg-rose-700"
              title="Видалити фото"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {item.nomenclatureId ? (
        <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={item.updateNomenclatureCard}
            onChange={(event) => onPatch({ updateNomenclatureCard: event.target.checked })}
            className="mt-0.5 rounded text-[#12325c]"
          />
          <span>
            {t("item.updateCard")}
            <span className="block text-[11px] text-slate-400">{t("item.updateCardHint")}</span>
          </span>
        </label>
      ) : null}

      {/* Попередження про можливі дублікати */}
      {activeDuplicates.length > 0 && !item.nomenclatureId ? (
        <div className="mt-3.5 animate-fade-in rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <span aria-hidden="true">⚠️</span>
              {t("nom.duplicateWarning")}
            </p>
            {checkingDuplicates ? (
              <span className="text-[11px] text-amber-700 animate-pulse">Оновлення збігів...</span>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {activeDuplicates.map((duplicate) => (
              <li
                key={duplicate.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/70 p-2 text-xs text-amber-900"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{duplicate.name}</span>
                  {duplicate.partNumber ? (
                    <span className="font-mono text-amber-700">{duplicate.partNumber}</span>
                  ) : null}
                  {duplicate.manufacturer ? (
                    <span className="text-slate-500">· {duplicate.manufacturer}</span>
                  ) : null}
                  <span className="rounded bg-amber-200/80 px-1 text-[10px] font-bold">
                    {Math.round(duplicate.score * 100)}% збіг
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-300 transition hover:bg-amber-100 shadow-2xs"
                  onClick={() => {
                    setProactiveDuplicates([]);
                    onPatch({
                      nomenclatureId: duplicate.id,
                      name: duplicate.name,
                      partNumber: duplicate.partNumber ?? "",
                      manufacturer: duplicate.manufacturer ?? item.manufacturer,
                      confirmNewNomenclature: false,
                    });
                  }}
                >
                  {t("nom.useExisting")}
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-amber-900">
            <input
              type="checkbox"
              checked={item.confirmNewNomenclature}
              onChange={(event) => onPatch({ confirmNewNomenclature: event.target.checked })}
              className="rounded text-[#12325c]"
            />
            {t("nom.sendToReview")}
          </label>
        </div>
      ) : null}
    </div>
  );
}
