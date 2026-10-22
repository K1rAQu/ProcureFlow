import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/*  Roles & users                                                             */
/* -------------------------------------------------------------------------- */

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  nameRu: text("name_ru").notNull(),
  nameUk: text("name_uk").notNull(),
  permissions: text("permissions", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Производственные цеха */
export const workshops = sqliteTable("workshops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  nameRu: text("name_ru").notNull(),
  nameUk: text("name_uk").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Отделы (направления) закупки: Импорт / Украина */
export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  nameRu: text("name_ru").notNull(),
  nameUk: text("name_uk").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Одиниці виміру (шт, кг, м, л тощо) */
export const unitsOfMeasurement = sqliteTable("units_of_measurement", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  nameRu: text("name_ru").notNull(),
  nameUk: text("name_uk").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash"),
    googleId: text("google_id").unique(),
    avatarUrl: text("avatar_url"),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    workshopId: integer("workshop_id").references(() => workshops.id),
    departmentId: integer("department_id").references(() => departments.id),
    locale: text("locale").notNull().default("uk"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tokenHash: text("token_hash").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Files                                                                     */
/* -------------------------------------------------------------------------- */

export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  checksum: text("checksum").notNull(),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/* -------------------------------------------------------------------------- */
/*  Nomenclature                                                              */
/* -------------------------------------------------------------------------- */

export const nomenclature = sqliteTable(
  "nomenclature",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    partNumber: text("part_number"),
    basCode: text("bas_code"),
    manufacturer: text("manufacturer"),
    url: text("url"),
    description: text("description"),
    specs: text("specs"),
    unit: text("unit").notNull().default("шт"),
    /** active | pending | archived | merged */
    status: text("status").notNull().default("active"),
    lastPrice: text("last_price"),
    lastCurrency: text("last_currency"),
    lastPriceAt: integer("last_price_at", { mode: "timestamp_ms" }),
    usageCount: integer("usage_count").notNull().default(0),
    mergedIntoId: integer("merged_into_id"),
    searchKey: text("search_key").notNull().default(""),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("nomenclature_name_idx").on(table.name),
    index("nomenclature_part_idx").on(table.partNumber),
    index("nomenclature_bas_idx").on(table.basCode),
    index("nomenclature_status_idx").on(table.status),
  ],
);

export const nomenclatureImages = sqliteTable(
  "nomenclature_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nomenclatureId: integer("nomenclature_id")
      .notNull()
      .references(() => nomenclature.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("nomenclature_images_item_idx").on(table.nomenclatureId)],
);

export const nomenclatureHistory = sqliteTable(
  "nomenclature_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nomenclatureId: integer("nomenclature_id")
      .notNull()
      .references(() => nomenclature.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    changes: text("changes", { mode: "json" }).$type<Record<string, { from: unknown; to: unknown }>>(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("nomenclature_history_item_idx").on(table.nomenclatureId)],
);

/* -------------------------------------------------------------------------- */
/*  Requests                                                                  */
/* -------------------------------------------------------------------------- */

export const requests = sqliteTable(
  "requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id),
    workshopId: integer("workshop_id")
      .notNull()
      .references(() => workshops.id),
    assigneeId: integer("assignee_id").references(() => users.id),
    parentRequestId: integer("parent_request_id"),
    /** draft | submitted | in_review | needs_info | purchasing | ordered | completed | rejected | cancelled */
    status: text("status").notNull().default("draft"),
    /** normal | high | urgent */
    priority: text("priority").notNull().default("normal"),
    comment: text("comment"),
    desiredDate: text("desired_date"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("requests_author_idx").on(table.authorId),
    index("requests_status_idx").on(table.status),
    index("requests_department_idx").on(table.departmentId),
    index("requests_workshop_idx").on(table.workshopId),
  ],
);

export const requestItems = sqliteTable(
  "request_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    nomenclatureId: integer("nomenclature_id").references(() => nomenclature.id),
    position: integer("position").notNull().default(0),
    name: text("name").notNull(),
    partNumber: text("part_number"),
    quantity: text("quantity").notNull(),
    unit: text("unit").notNull().default("шт"),
    unitPrice: text("unit_price"),
    currency: text("currency"),
    url: text("url"),
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("request_items_request_idx").on(table.requestId)],
);

export const requestItemImages = sqliteTable(
  "request_item_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestItemId: integer("request_item_id")
      .notNull()
      .references(() => requestItems.id, { onDelete: "cascade" }),
    fileId: integer("file_id")
      .notNull()
      .references(() => files.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("request_item_images_item_idx").on(table.requestItemId)],
);

/** История/лента событий заявки: смена статуса, комментарии, уточнения, правки */
export const requestEvents = sqliteTable(
  "request_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id),
    /** created | submitted | status_change | comment | clarification | answer | edit | assign | split */
    type: text("type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    message: text("message"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("request_events_request_idx").on(table.requestId)],
);

/* -------------------------------------------------------------------------- */
/*  Infrastructure                                                            */
/* -------------------------------------------------------------------------- */

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: integer("request_id").references(() => requests.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary"),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_idx").on(table.createdAt),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** Счётчики для генерации номеров заявок */
export const counters = sqliteTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

/** Идемпотентность отправки форм (защита от двойного клика) */
export const idempotencyKeys = sqliteTable("idempotency_keys", {
  key: text("key").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Workshop = typeof workshops.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type UnitOfMeasurement = typeof unitsOfMeasurement.$inferSelect;
export type NomenclatureRow = typeof nomenclature.$inferSelect;
export type RequestRow = typeof requests.$inferSelect;
export type RequestItemRow = typeof requestItems.$inferSelect;
export type RequestEventRow = typeof requestEvents.$inferSelect;
