import "server-only";
import { and, asc, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  nomenclature,
  nomenclatureHistory,
  nomenclatureImages,
  requestItems,
  requests,
  users,
} from "@/db/schema";
import { HttpError, type SessionUser } from "./auth";
import { buildSearchKey, findDuplicates, normalizePartNumber, type DuplicateMatch } from "./dedupe";
import { diffObjects, writeAudit } from "./audit";
import type { NomenclatureCreatePayload } from "./validation";

export type NomenclatureListItem = {
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
  updatedAt: Date;
  imageId: number | null;
};

export type SearchOptions = {
  query?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sort?: "name" | "updated" | "usage";
  includeArchived?: boolean;
  myUserId?: number;
};

export async function searchNomenclature(options: SearchOptions): Promise<{
  items: NomenclatureListItem[];
  total: number;
}> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const conditions = [];

  const query = options.query?.trim();
  if (query) {
    const likePattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    const lowerLike = likePattern.toLowerCase();
    const compact = `%${normalizePartNumber(query)}%`;
    conditions.push(
      or(
        sql`lower(${nomenclature.name}) like ${lowerLike}`,
        sql`lower(${nomenclature.partNumber}) like ${lowerLike}`,
        sql`lower(${nomenclature.basCode}) like ${lowerLike}`,
        sql`lower(${nomenclature.manufacturer}) like ${lowerLike}`,
        like(nomenclature.searchKey, compact),
      ),
    );
  }
  if (options.status && options.status !== "all") {
    conditions.push(eq(nomenclature.status, options.status));
  } else if (!options.includeArchived) {
    conditions.push(inArray(nomenclature.status, ["active", "pending"]));
  } else {
    conditions.push(ne(nomenclature.status, "merged"));
  }

  if (options.myUserId) {
    conditions.push(
      or(
        eq(nomenclature.createdBy, options.myUserId),
        sql`exists (
          select 1 from request_items ri
          inner join requests r on r.id = ri.request_id
          where ri.nomenclature_id = ${nomenclature.id}
            and r.author_id = ${options.myUserId}
        )`,
      )!,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    options.sort === "name"
      ? asc(nomenclature.name)
      : options.sort === "usage"
        ? desc(nomenclature.usageCount)
        : desc(nomenclature.updatedAt);

  const rows = await db
    .select({
      id: nomenclature.id,
      name: nomenclature.name,
      partNumber: nomenclature.partNumber,
      basCode: nomenclature.basCode,
      manufacturer: nomenclature.manufacturer,
      url: nomenclature.url,
      unit: nomenclature.unit,
      status: nomenclature.status,
      lastPrice: nomenclature.lastPrice,
      lastCurrency: nomenclature.lastCurrency,
      usageCount: nomenclature.usageCount,
      updatedAt: nomenclature.updatedAt,
    })
    .from(nomenclature)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(nomenclature)
    .where(where);

  const images = rows.length
    ? await db
        .select({ nomenclatureId: nomenclatureImages.nomenclatureId, fileId: nomenclatureImages.fileId })
        .from(nomenclatureImages)
        .where(
          inArray(
            nomenclatureImages.nomenclatureId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(nomenclatureImages.sortOrder))
    : [];

  const imageByItem = new Map<number, number>();
  for (const image of images) {
    if (!imageByItem.has(image.nomenclatureId)) imageByItem.set(image.nomenclatureId, image.fileId);
  }

  return {
    items: rows.map((row) => ({ ...row, imageId: imageByItem.get(row.id) ?? null })),
    total,
  };
}

export async function findDuplicateCandidates(input: {
  name: string;
  partNumber?: string | null;
  basCode?: string | null;
  excludeId?: number;
}): Promise<DuplicateMatch[]> {
  const tokens = input.name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 4);
  const partKey = normalizePartNumber(input.partNumber);
  const basKey = normalizePartNumber(input.basCode);
  const filters = [];
  for (const token of tokens) filters.push(sql`lower(${nomenclature.name}) like ${'%' + token.toLowerCase() + '%'}`);
  if (partKey) filters.push(like(nomenclature.searchKey, `%${partKey}%`));
  if (basKey) filters.push(like(nomenclature.searchKey, `%${basKey}%`));
  if (!filters.length) filters.push(sql`lower(${nomenclature.name}) like ${'%' + input.name.slice(0, 12).toLowerCase() + '%'}`);

  const rows = await db
    .select({
      id: nomenclature.id,
      name: nomenclature.name,
      partNumber: nomenclature.partNumber,
      basCode: nomenclature.basCode,
      manufacturer: nomenclature.manufacturer,
    })
    .from(nomenclature)
    .where(and(inArray(nomenclature.status, ["active", "pending"]), or(...filters)))
    .limit(60);

  const candidates = input.excludeId ? rows.filter((row) => row.id !== input.excludeId) : rows;
  return findDuplicates({ name: input.name, partNumber: input.partNumber, basCode: input.basCode }, candidates);
}

export async function createNomenclature(
  payload: NomenclatureCreatePayload,
  user: SessionUser,
  options: { autoApprove: boolean; forcePending?: boolean } = { autoApprove: true },
): Promise<{ id: number; status: string }> {
  const status = options.forcePending || !options.autoApprove ? "pending" : "active";
  const [row] = await db
    .insert(nomenclature)
    .values({
      name: payload.name,
      partNumber: payload.partNumber ?? null,
      basCode: payload.basCode ?? null,
      manufacturer: payload.manufacturer ?? null,
      url: payload.url ?? null,
      description: payload.description ?? null,
      specs: payload.specs ?? null,
      unit: payload.unit || "шт",
      status,
      lastPrice: payload.lastPrice !== null && payload.lastPrice !== undefined ? String(payload.lastPrice) : null,
      lastCurrency: payload.lastCurrency ?? null,
      lastPriceAt: payload.lastPrice !== null && payload.lastPrice !== undefined ? new Date() : null,
      searchKey: buildSearchKey({
        name: payload.name,
        partNumber: payload.partNumber,
        basCode: payload.basCode,
        manufacturer: payload.manufacturer,
      }),
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: nomenclature.id, status: nomenclature.status });

  if (payload.fileIds?.length) {
    await db.insert(nomenclatureImages).values(
      payload.fileIds.map((fileId, index) => ({
        nomenclatureId: row.id,
        fileId,
        sortOrder: index,
      })),
    );
  }

  await db.insert(nomenclatureHistory).values({
    nomenclatureId: row.id,
    userId: user.id,
    action: "created",
    changes: null,
    note: status === "pending" ? "Створена та надіслана на перевірку" : null,
  });
  await writeAudit({
    userId: user.id,
    action: "nomenclature.create",
    entityType: "nomenclature",
    entityId: row.id,
    summary: payload.name,
  });
  return row;
}

const TRACKED_FIELDS = [
  "name",
  "partNumber",
  "basCode",
  "manufacturer",
  "url",
  "description",
  "specs",
  "unit",
  "status",
  "lastPrice",
  "lastCurrency",
];

export async function updateNomenclature(
  id: number,
  patch: Partial<NomenclatureCreatePayload> & { status?: string },
  user: SessionUser,
  note?: string,
): Promise<void> {
  const [current] = await db.select().from(nomenclature).where(eq(nomenclature.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");

  const next: Record<string, unknown> = {};
  for (const field of [
    "name",
    "partNumber",
    "basCode",
    "manufacturer",
    "url",
    "description",
    "specs",
    "unit",
    "status",
  ]) {
    const value = (patch as Record<string, unknown>)[field];
    if (value !== undefined) next[field] = value;
  }
  if (patch.lastPrice !== undefined) {
    next.lastPrice = patch.lastPrice === null ? null : String(patch.lastPrice);
    next.lastPriceAt = new Date();
  }
  if (patch.lastCurrency !== undefined) next.lastCurrency = patch.lastCurrency;

  if (
    next.name ||
    next.partNumber !== undefined ||
    next.basCode !== undefined ||
    next.manufacturer !== undefined
  ) {
    next.searchKey = buildSearchKey({
      name: (next.name as string) ?? current.name,
      partNumber: (next.partNumber as string | null) ?? current.partNumber,
      basCode: (next.basCode as string | null) ?? current.basCode,
      manufacturer: (next.manufacturer as string | null) ?? current.manufacturer,
    });
  }

  const changes = diffObjects(
    current as unknown as Record<string, unknown>,
    { ...(current as unknown as Record<string, unknown>), ...next },
    TRACKED_FIELDS,
  );

  if (patch.fileIds) {
    await db.delete(nomenclatureImages).where(eq(nomenclatureImages.nomenclatureId, id));
    if (patch.fileIds.length) {
      await db
        .insert(nomenclatureImages)
        .values(patch.fileIds.map((fileId, index) => ({ nomenclatureId: id, fileId, sortOrder: index })));
    }
    changes.images = { from: "updated", to: `${patch.fileIds.length}` };
  }

  if (!Object.keys(changes).length) return;

  await db
    .update(nomenclature)
    .set({ ...next, updatedBy: user.id, updatedAt: new Date() })
    .where(eq(nomenclature.id, id));

  await db.insert(nomenclatureHistory).values({
    nomenclatureId: id,
    userId: user.id,
    action: "updated",
    changes,
    note: note ?? null,
  });
  await writeAudit({
    userId: user.id,
    action: "nomenclature.update",
    entityType: "nomenclature",
    entityId: id,
    summary: current.name,
    payload: changes,
  });
}

export async function setNomenclatureStatus(id: number, status: string, user: SessionUser): Promise<void> {
  await updateNomenclature(id, { status }, user, `status:${status}`);
}

/** Объединение дубликатов: история закупок сохраняется, позиции переносятся на основную карточку. */
export async function mergeNomenclature(sourceId: number, targetId: number, user: SessionUser): Promise<void> {
  if (sourceId === targetId) throw new HttpError(400, "same_record");
  const rows = await db.select().from(nomenclature).where(inArray(nomenclature.id, [sourceId, targetId]));
  const source = rows.find((row) => row.id === sourceId);
  const target = rows.find((row) => row.id === targetId);
  if (!source || !target) throw new HttpError(404, "not_found");
  if (source.status === "merged") throw new HttpError(400, "already_merged");

  await db.transaction(async (tx) => {
    await tx
      .update(requestItems)
      .set({ nomenclatureId: targetId })
      .where(eq(requestItems.nomenclatureId, sourceId));
    await tx
      .update(nomenclatureImages)
      .set({ nomenclatureId: targetId })
      .where(eq(nomenclatureImages.nomenclatureId, sourceId));
    await tx
      .update(nomenclature)
      .set({
        status: "merged",
        mergedIntoId: targetId,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(nomenclature.id, sourceId));
    await tx
      .update(nomenclature)
      .set({
        usageCount: target.usageCount + source.usageCount,
        basCode: target.basCode || source.basCode || null,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(nomenclature.id, targetId));
    await tx.insert(nomenclatureHistory).values([
      {
        nomenclatureId: sourceId,
        userId: user.id,
        action: "merged_into",
        changes: { mergedIntoId: { from: null, to: targetId } },
        note: `Об'єднано з #${targetId} (${target.name})`,
      },
      {
        nomenclatureId: targetId,
        userId: user.id,
        action: "merged_from",
        changes: null,
        note: `Приєднано картку #${sourceId} (${source.name})`,
      },
    ]);
  });

  await writeAudit({
    userId: user.id,
    action: "nomenclature.merge",
    entityType: "nomenclature",
    entityId: targetId,
    summary: `${source.name} → ${target.name}`,
    payload: { sourceId, targetId },
  });
}

export async function getNomenclatureCard(id: number) {
  const [card] = await db
    .select({
      item: nomenclature,
      createdBy: users.fullName,
    })
    .from(nomenclature)
    .leftJoin(users, eq(users.id, nomenclature.createdBy))
    .where(eq(nomenclature.id, id))
    .limit(1);
  if (!card) return null;

  const images = await db
    .select({ fileId: nomenclatureImages.fileId })
    .from(nomenclatureImages)
    .where(eq(nomenclatureImages.nomenclatureId, id))
    .orderBy(asc(nomenclatureImages.sortOrder));

  const history = await db
    .select({
      id: nomenclatureHistory.id,
      action: nomenclatureHistory.action,
      changes: nomenclatureHistory.changes,
      note: nomenclatureHistory.note,
      createdAt: nomenclatureHistory.createdAt,
      userName: users.fullName,
    })
    .from(nomenclatureHistory)
    .leftJoin(users, eq(users.id, nomenclatureHistory.userId))
    .where(eq(nomenclatureHistory.nomenclatureId, id))
    .orderBy(desc(nomenclatureHistory.createdAt))
    .limit(80);

  const usage = await db
    .select({
      itemId: requestItems.id,
      quantity: requestItems.quantity,
      unitPrice: requestItems.unitPrice,
      currency: requestItems.currency,
      requestId: requests.id,
      number: requests.number,
      status: requests.status,
      createdAt: requests.createdAt,
      authorName: users.fullName,
    })
    .from(requestItems)
    .innerJoin(requests, eq(requests.id, requestItems.requestId))
    .leftJoin(users, eq(users.id, requests.authorId))
    .where(eq(requestItems.nomenclatureId, id))
    .orderBy(desc(requests.createdAt))
    .limit(50);

  return { ...card.item, createdByName: card.createdBy, images, history, usage };
}
