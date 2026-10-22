import { z } from "zod";
import { CURRENCIES, PRIORITIES, REQUEST_STATUSES } from "./workflow.ts";
import { LOCALES } from "./i18n.ts";

const trimmed = (max: number) => z.string().trim().max(max);

/** Необязательная строка: пустые значения превращаются в null, ключ можно не передавать. */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) => {
      const text = value === null || value === undefined ? "" : String(value).trim();
      return text.length ? text.slice(0, max) : null;
    });

const urlField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text.length ? text : null;
  })
  .refine(
    (value) => {
      if (!value) return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "invalid_url" },
  );

const numberLike = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: "custom", message: "not_a_number" });
    return z.NEVER;
  }
  return parsed;
});

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "not_a_number" });
      return z.NEVER;
    }
    return parsed;
  });

const emailValidator = trimmed(255)
  .toLowerCase()
  .refine((val) => /^[^\s@]+@[^\s@]+$/.test(val), { message: "invalid_email" });

export const loginSchema = z.object({
  email: emailValidator,
  password: z.string().min(1).max(200),
});

export const setupSchema = z.object({
  email: emailValidator,
  fullName: trimmed(255).min(2),
  password: z.string().min(8).max(200),
});

export const requestItemSchema = z.object({
  id: z.number().int().positive().optional(),
  nomenclatureId: z.number().int().positive().nullable().optional(),
  name: trimmed(300).min(2),
  partNumber: optionalText(160),
  quantity: numberLike.refine((value) => value > 0, { message: "quantity_positive" }),
  unit: optionalText(32),
  unitPrice: optionalNumber.refine((value) => value === null || value >= 0, { message: "price_positive" }),
  currency: z
    .union([z.enum(CURRENCIES), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  url: urlField,
  comment: optionalText(2000),
  manufacturer: optionalText(160),
  fileIds: z.array(z.number().int().positive()).max(8).default([]),
  /** явное подтверждение обновления карточки номенклатуры данными строки */
  updateNomenclatureCard: z.boolean().optional().default(false),
  /** пользователь подтвердил создание новой карточки, несмотря на похожие позиции */
  confirmNewNomenclature: z.boolean().optional().default(false),
});

export const requestPayloadSchema = z.object({
  departmentId: z.number().int().positive(),
  workshopId: z.number().int().positive(),
  priority: z.enum(PRIORITIES).default("normal"),
  desiredDate: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      const text = value === null || value === undefined ? "" : String(value).trim();
      return text.length ? text.slice(0, 10) : null;
    })
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "invalid_date" }),
  comment: optionalText(4000),
  items: z.array(requestItemSchema).min(1, { message: "items_required" }).max(100),
  submit: z.boolean().optional().default(false),
  idempotencyKey: z.string().trim().max(120).optional(),
});

export const statusChangeSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
  comment: optionalText(2000),
});

export const commentSchema = z.object({
  message: trimmed(2000).min(1),
  type: z.enum(["comment", "answer"]).default("comment"),
});

export const assignSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
});

export const splitSchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1),
  departmentId: z.number().int().positive(),
  workshopId: z.number().int().positive(),
});

export const nomenclatureCreateSchema = z.object({
  name: trimmed(300).min(2),
  partNumber: optionalText(160),
  basCode: optionalText(120),
  manufacturer: optionalText(160),
  url: urlField,
  description: optionalText(4000),
  specs: optionalText(4000),
  unit: optionalText(32),
  lastPrice: optionalNumber,
  lastCurrency: z
    .union([z.enum(CURRENCIES), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  fileIds: z.array(z.number().int().positive()).max(8).default([]),
  /** подтверждение создания, несмотря на найденные дубликаты */
  confirmDuplicate: z.boolean().optional().default(false),
});

export const nomenclatureUpdateSchema = nomenclatureCreateSchema.partial().extend({
  status: z.enum(["active", "pending", "archived"]).optional(),
});

export const mergeSchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});

export const directorySchema = z
  .object({
    code: trimmed(64).min(1).regex(/^[a-z0-9_-]+$/i, { message: "invalid_code" }),
    name: trimmed(160).min(1).optional(),
    nameRu: trimmed(160).min(1).optional(),
    nameUk: trimmed(160).min(1).optional(),
    description: optionalText(1000),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10000).default(100),
  })
  .refine((data) => Boolean(data.name || data.nameUk || data.nameRu), {
    message: "name_required",
  })
  .transform((data) => {
    const name = data.name ?? data.nameUk ?? data.nameRu ?? "";
    return {
      ...data,
      nameRu: data.nameRu ?? name,
      nameUk: data.nameUk ?? name,
    };
  });

export const directoryUpdateSchema = z.object({
  code: trimmed(64).min(1).regex(/^[a-z0-9_-]+$/i, { message: "invalid_code" }).optional(),
  name: trimmed(160).min(1).optional(),
  nameRu: trimmed(160).min(1).optional(),
  nameUk: trimmed(160).min(1).optional(),
  description: optionalText(1000),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const userCreateSchema = z.object({
  email: emailValidator,
  fullName: trimmed(255).min(2),
  password: z.string().min(8).max(200),
  roleId: z.number().int().positive(),
  workshopId: z.number().int().positive().nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  locale: z.enum(LOCALES).default("uk"),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  fullName: trimmed(255).min(2).optional(),
  password: z.union([z.string().min(8).max(200), z.literal(""), z.null()]).optional(),
  roleId: z.number().int().positive().optional(),
  workshopId: z.number().int().positive().nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  locale: z.enum(LOCALES).optional(),
  isActive: z.boolean().optional(),
});

export const roleSchema = z
  .object({
    code: trimmed(64).min(2).regex(/^[a-z0-9_]+$/, { message: "invalid_code" }),
    name: trimmed(128).min(2).optional(),
    nameRu: trimmed(128).min(2).optional(),
    nameUk: trimmed(128).min(2).optional(),
    permissions: z.array(z.string().max(64)).max(64),
  })
  .refine((data) => Boolean(data.name || data.nameUk || data.nameRu), {
    message: "name_required",
  })
  .transform((data) => {
    const name = data.name ?? data.nameUk ?? data.nameRu ?? "";
    return {
      ...data,
      nameRu: data.nameRu ?? name,
      nameUk: data.nameUk ?? name,
    };
  });

export const roleUpdateSchema = z.object({
  name: trimmed(128).min(2).optional(),
  nameRu: trimmed(128).min(2).optional(),
  nameUk: trimmed(128).min(2).optional(),
  permissions: z.array(z.string().max(64)).max(64).optional(),
});

export const settingsSchema = z.object({
  defaultLocale: z.enum(LOCALES).optional(),
  editableStatuses: z.array(z.enum(REQUEST_STATUSES)).optional(),
  requiredItemFields: z.array(z.enum(["partNumber", "unitPrice", "currency", "url", "photo"])).optional(),
  autoApproveNomenclature: z.boolean().optional(),
  maxUploadMb: z.number().int().min(1).max(50).optional(),
  sessionTimeoutMinutes: z.number().int().min(0).max(1440).optional(),
});

export type RequestPayload = z.infer<typeof requestPayloadSchema>;
export type RequestItemPayload = z.infer<typeof requestItemSchema>;
export type NomenclatureCreatePayload = z.infer<typeof nomenclatureCreateSchema>;
export type SystemSettingsPayload = z.infer<typeof settingsSchema>;
