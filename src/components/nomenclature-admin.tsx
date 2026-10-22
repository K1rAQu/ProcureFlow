"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import { Modal } from "./modal";
import { useT } from "./i18n-provider";
import { useConfirm } from "./confirm-provider";
import { CURRENCIES } from "@/lib/workflow";
import { compressImage } from "@/lib/client-image";

type Image = { id: number; url: string };

type DuplicateMatch = {
  id: number;
  name: string;
  partNumber: string | null;
  basCode?: string | null;
  score: number;
};

function ImageUploader({ images, onChange }: { images: Image[]; onChange: (next: Image[]) => void }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={async (event) => {
            const list = event.target.files;
            if (!list?.length) return;
            setBusy(true);
            setError(null);
            const uploaded: Image[] = [];
            for (const rawFile of Array.from(list).slice(0, 4)) {
              const file = await compressImage(rawFile);
              const formData = new FormData();
              formData.append("file", file);
              const response = await fetch("/api/files", { method: "POST", body: formData });
              if (response.ok) {
                const data = (await response.json()) as { id: number; url: string };
                uploaded.push({ id: data.id, url: data.url });
              } else {
                const data = (await response.json().catch(() => ({ error: "" }))) as { error: string };
                setError(data.error === "file_too_large" ? t("error.fileSize") : t("error.fileType"));
              }
            }
            onChange([...images, ...uploaded].slice(0, 8));
            setBusy(false);
            event.target.value = "";
          }}
        />
        📎 {t("nom.images")}
      </label>
      {busy ? <span className="text-xs text-slate-400">{t("common.loading")}</span> : null}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      {images.map((image) => (
        <span key={image.id} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-slate-200" />
          <button
            type="button"
            onClick={() => onChange(images.filter((candidate) => candidate.id !== image.id))}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}

export function NewNomenclatureButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    partNumber: "",
    basCode: "",
    manufacturer: "",
    url: "",
    description: "",
    specs: "",
    unit: "шт",
    lastPrice: "",
    lastCurrency: "UAH",
  });
  const [images, setImages] = useState<Image[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/nomenclature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        lastPrice: form.lastPrice === "" ? null : form.lastPrice,
        fileIds: images.map((image) => image.id),
        confirmDuplicate,
      }),
    });
    setBusy(false);
    if (response.ok) {
      setOpen(false);
      setForm({
        name: "",
        partNumber: "",
        basCode: "",
        manufacturer: "",
        url: "",
        description: "",
        specs: "",
        unit: "шт",
        lastPrice: "",
        lastCurrency: "UAH",
      });
      setImages([]);
      setDuplicates([]);
      setConfirmDuplicate(false);
      router.refresh();
      return;
    }
    const data = (await response.json().catch(() => ({}))) as { duplicates?: DuplicateMatch[]; error?: string };
    if (data.duplicates?.length) {
      setDuplicates(data.duplicates);
      setError(t("nom.duplicateWarning"));
    } else {
      setError(t("error.generic"));
    }
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + {t("nom.new")}
      </Button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("nom.new")}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={busy || form.name.trim().length < 2} onClick={save}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("item.name")} required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label={t("item.partNumber")}>
            <Input value={form.partNumber} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} />
          </Field>
          <Field label={t("nom.basCode")} hint={t("nom.basCodeHint")}>
            <Input
              value={form.basCode}
              placeholder="00-00000000"
              onChange={(event) => setForm({ ...form, basCode: event.target.value })}
            />
          </Field>
          <Field label={t("nom.manufacturer")} className="sm:col-span-2">
            <Input
              value={form.manufacturer}
              onChange={(event) => setForm({ ...form, manufacturer: event.target.value })}
            />
          </Field>
          <Field label={t("item.url")} className="sm:col-span-2">
            <Input
              type="url"
              placeholder="https://"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
            />
          </Field>
          <Field label={t("item.unit")}>
            <Input
              list="unit-options"
              value={form.unit}
              placeholder="шт"
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
            />
            <datalist id="unit-options">
              {["шт", "м", "кг", "л", "компл", "пач", "т", "рул", "м²", "м³", "ящ"].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("nom.lastPrice")}>
              <Input
                inputMode="decimal"
                value={form.lastPrice}
                onChange={(event) => setForm({ ...form, lastPrice: event.target.value })}
              />
            </Field>
            <Field label={t("item.currency")}>
              <Select
                value={form.lastCurrency}
                onChange={(event) => setForm({ ...form, lastCurrency: event.target.value })}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("nom.description")} className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label={t("nom.specs")} className="sm:col-span-2">
            <Textarea rows={2} value={form.specs} onChange={(event) => setForm({ ...form, specs: event.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <ImageUploader images={images} onChange={setImages} />
          </div>

          {duplicates.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
              <p className="text-xs font-medium text-amber-900">{t("nom.duplicateWarning")}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    {duplicate.name}
                    {duplicate.partNumber ? ` · ${duplicate.partNumber}` : ""}
                    {duplicate.basCode ? ` · 1С: ${duplicate.basCode}` : ""} (
                    {Math.round(duplicate.score * 100)}%)
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmDuplicate}
                  onChange={(event) => setConfirmDuplicate(event.target.checked)}
                />
                {t("common.confirm")}
              </label>
            </div>
          ) : null}

          {error ? <p className="text-xs text-rose-600 sm:col-span-2">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}

export function NomenclatureRowActions({
  id,
  status,
  canArchive,
  canApprove,
}: {
  id: number;
  status: string;
  canArchive: boolean;
  canApprove: boolean;
}) {
  const t = useT();
  const confirm = useConfirm();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/nomenclature/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {canApprove && status === "pending" ? (
        <Button type="button" size="sm" variant="success" disabled={busy} onClick={() => patch({ status: "active" })}>
          {t("nom.approve")}
        </Button>
      ) : null}
      {canArchive && status !== "archived" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm({
              title: t("nom.archiveTitle"),
              message: t("nom.archiveConfirm"),
              confirmText: t("common.archive"),
              cancelText: t("common.close"),
              tone: "danger",
            });
            if (ok) void patch({ status: "archived" });
          }}
        >
          {t("common.archive")}
        </Button>
      ) : null}
      {canArchive && status === "archived" ? (
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => patch({ status: "active" })}>
          {t("common.restore")}
        </Button>
      ) : null}
    </span>
  );
}

export function NomenclatureEditor({
  id,
  initial,
  images: initialImages,
}: {
  id: number;
  initial: {
    name: string;
    partNumber: string;
    basCode: string;
    manufacturer: string;
    url: string;
    description: string;
    specs: string;
    unit: string;
    lastPrice: string;
    lastCurrency: string;
  };
  images: Image[];
}) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [images, setImages] = useState<Image[]>(initialImages);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title={t("common.edit")} description={t("nom.card")} />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label={t("item.name")} required className="sm:col-span-2">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label={t("item.partNumber")}>
          <Input value={form.partNumber} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} />
        </Field>
        <Field label={t("nom.basCode")} hint={t("nom.basCodeHint")}>
          <Input
            value={form.basCode}
            placeholder="00-00000000"
            onChange={(event) => setForm({ ...form, basCode: event.target.value })}
          />
        </Field>
        <Field label={t("nom.manufacturer")} className="sm:col-span-2">
          <Input
            value={form.manufacturer}
            onChange={(event) => setForm({ ...form, manufacturer: event.target.value })}
          />
        </Field>
        <Field label={t("item.url")} className="sm:col-span-2">
          <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
        </Field>
        <Field label={t("item.unit")}>
          <Input
            list="unit-options-edit"
            value={form.unit}
            placeholder="шт"
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
          />
          <datalist id="unit-options-edit">
            {["шт", "м", "кг", "л", "компл", "пач", "т", "рул", "м²", "м³", "ящ"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("nom.lastPrice")}>
            <Input
              inputMode="decimal"
              value={form.lastPrice}
              onChange={(event) => setForm({ ...form, lastPrice: event.target.value })}
            />
          </Field>
          <Field label={t("item.currency")}>
            <Select
              value={form.lastCurrency}
              onChange={(event) => setForm({ ...form, lastCurrency: event.target.value })}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("nom.description")} className="sm:col-span-2">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <Field label={t("nom.specs")} className="sm:col-span-2">
          <Textarea rows={2} value={form.specs} onChange={(event) => setForm({ ...form, specs: event.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <ImageUploader images={images} onChange={setImages} />
        </div>
        {error ? <p className="text-xs text-rose-600 sm:col-span-2">{error}</p> : null}
        {saved ? <p className="text-xs text-emerald-600 sm:col-span-2">{t("common.saved")}</p> : null}
      </div>
      <footer className="flex justify-end border-t border-slate-200 px-4 py-3">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setSaved(false);
            const response = await fetch(`/api/nomenclature/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...form,
                lastPrice: form.lastPrice === "" ? null : form.lastPrice,
                fileIds: images.map((image) => image.id),
              }),
            });
            setBusy(false);
            if (response.ok) {
              setSaved(true);
              router.refresh();
            } else {
              setError(t("error.generic"));
            }
          }}
        >
          {busy ? t("common.saving") : t("common.save")}
        </Button>
      </footer>
    </Card>
  );
}

export function MergePanel({ currentId }: { currentId: number }) {
  const t = useT();
  const confirm = useConfirm();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ id: number; name: string; partNumber: string | null; basCode?: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title={t("nom.merge")} description={t("nom.mergeSource")} />
      <div className="space-y-3 p-4">
        <Field label={t("common.search")}>
          <Input
            value={query}
            placeholder={t("item.searchPlaceholder")}
            onChange={async (event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) {
                setHits([]);
                return;
              }
              const response = await fetch(`/api/nomenclature?q=${encodeURIComponent(value.trim())}&limit=6`);
              if (response.ok) {
                const data = (await response.json()) as {
                  items: { id: number; name: string; partNumber: string | null; basCode?: string | null }[];
                };
                setHits(data.items.filter((item) => item.id !== currentId));
              }
            }}
          />
        </Field>
        <ul className="space-y-1">
          {hits.map((hit) => (
            <li key={hit.id} className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span className="truncate">
                {hit.name}
                {hit.partNumber ? ` · ${hit.partNumber}` : ""}
                {hit.basCode ? ` · 1С: ${hit.basCode}` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: t("nom.mergeTitle"),
                    message: t("nom.mergeConfirm", { sourceId: hit.id, targetId: currentId }),
                    confirmText: t("nom.merge"),
                    cancelText: t("common.close"),
                    tone: "primary",
                  });
                  if (!ok) return;
                  setBusy(true);
                  setError(null);
                  const response = await fetch("/api/nomenclature/merge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sourceId: hit.id, targetId: currentId }),
                  });
                  setBusy(false);
                  if (response.ok) {
                    setDone(true);
                    setHits([]);
                    setQuery("");
                    router.refresh();
                  } else {
                    setError(t("error.generic"));
                  }
                }}
              >
                {t("nom.merge")}
              </Button>
            </li>
          ))}
        </ul>
        {done ? <p className="text-xs text-emerald-600">{t("nom.mergeDone")}</p> : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </Card>
  );
}
