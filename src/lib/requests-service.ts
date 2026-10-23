import "server-only";
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  idempotencyKeys,
  nomenclature,
  requestEvents,
  requestItemImages,
  requestItems,
  requests,
  roles,
  users,
  workshops,
} from "@/db/schema";
import { HttpError, type SessionUser } from "./auth";
import { writeAudit, notify } from "./audit";
import { notifyRequestCreated, notifyStatusChanged, notifyRequestAssigned } from "./email-service";
import { createNomenclature, findDuplicateCandidates, updateNomenclature } from "./nomenclature-service";
import { getSettings } from "./settings";
import {
  checkTransition,
  canEditRequest,
  formatRequestNumber,
  TERMINAL_STATUSES,
  type Actor,
  type RequestStatus,
} from "./workflow";
import type { RequestItemPayload, RequestPayload } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function nextRequestNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const key = `request:${year}`;
  const rows = await tx.all<{ value: number }>(
    sql`insert into counters (key, value) values (${key}, 1)
        on conflict (key) do update set value = counters.value + 1
        returning value`,
  );
  const row = rows[0];
  return formatRequestNumber(year, row?.value ?? 1);
}

export function actorsFor(user: SessionUser, request: { authorId: number; assigneeId: number | null }): Actor[] {
  const actors: Actor[] = [];
  if (request.authorId === user.id) actors.push("author");
  if (user.permissions.includes("requests.process")) actors.push("processor");
  return actors;
}

export function canViewRequest(
  user: SessionUser,
  request: { authorId: number; assigneeId: number | null; workshopId: number },
): boolean {
  if (request.authorId === user.id) return true;
  if (request.assigneeId === user.id) return true;
  if (user.permissions.includes("requests.view_all")) return true;
  if (
    user.permissions.includes("requests.view_workshop") &&
    user.workshopId !== null &&
    user.workshopId === request.workshopId
  ) {
    return true;
  }
  return false;
}

async function assertDirectories(departmentId: number, workshopId: number): Promise<void> {
  const [department] = await db
    .select({ id: departments.id, isActive: departments.isActive })
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);
  if (!department || !department.isActive) throw new HttpError(400, "invalid_department");
  const [workshop] = await db
    .select({ id: workshops.id, isActive: workshops.isActive })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1);
  if (!workshop || !workshop.isActive) throw new HttpError(400, "invalid_workshop");
}

type ResolvedItem = RequestItemPayload & { nomenclatureId: number | null };

/** Серверная проверка полей позиции, обязательность которых настраивает администратор. */
function assertRequiredItemFields(items: RequestItemPayload[], required: string[]): void {
  if (!required.length) return;
  for (const [index, item] of items.entries()) {
    for (const field of required) {
      const missing =
        (field === "partNumber" && !item.partNumber) ||
        (field === "unitPrice" && (item.unitPrice === null || item.unitPrice === undefined)) ||
        (field === "currency" && !item.currency) ||
        (field === "url" && !item.url) ||
        (field === "photo" && !(item.fileIds ?? []).length);
      if (missing) throw new HttpError(422, "item_field_required", { index, field });
    }
  }
}

/**
 * Привязка строк заявки к общей номенклатуре.
 * Новая позиция создаётся только после явного подтверждения пользователя,
 * автоматические дубликаты не создаются.
 */
async function resolveNomenclature(items: RequestItemPayload[], user: SessionUser): Promise<ResolvedItem[]> {
  const settings = await getSettings();
  const resolved: ResolvedItem[] = [];
  const conflicts: { index: number; name: string; candidates: unknown[] }[] = [];

  for (const [index, item] of items.entries()) {
    if (item.nomenclatureId) {
      const [card] = await db
        .select({ id: nomenclature.id, status: nomenclature.status, mergedIntoId: nomenclature.mergedIntoId })
        .from(nomenclature)
        .where(eq(nomenclature.id, item.nomenclatureId))
        .limit(1);
      if (!card) throw new HttpError(400, "unknown_nomenclature");
      resolved.push({ ...item, nomenclatureId: card.mergedIntoId ?? card.id });
      continue;
    }

    const candidates = await findDuplicateCandidates({ name: item.name, partNumber: item.partNumber });
    if (candidates.length && !item.confirmNewNomenclature) {
      conflicts.push({ index, name: item.name, candidates });
      resolved.push({ ...item, nomenclatureId: null });
      continue;
    }

    const forcePending = candidates.length > 0 && !user.permissions.includes("nomenclature.approve");
    const created = await createNomenclature(
      {
        name: item.name,
        partNumber: item.partNumber ?? null,
        basCode: null,
        manufacturer: item.manufacturer ?? null,
        url: item.url ?? null,
        description: null,
        specs: null,
        unit: item.unit ?? "шт",
        lastPrice: item.unitPrice ?? null,
        lastCurrency: item.currency ?? null,
        fileIds: item.fileIds ?? [],
        confirmDuplicate: true,
      },
      user,
      { autoApprove: settings.autoApproveNomenclature, forcePending },
    );
    resolved.push({ ...item, nomenclatureId: created.id });
  }

  if (conflicts.length) {
    throw new HttpError(409, "duplicates_found", { conflicts });
  }
  return resolved;
}

async function syncCardsFromItems(items: ResolvedItem[], user: SessionUser): Promise<void> {
  for (const item of items) {
    if (!item.nomenclatureId) continue;
    const [card] = await db
      .select()
      .from(nomenclature)
      .where(eq(nomenclature.id, item.nomenclatureId))
      .limit(1);
    if (!card) continue;

    if (item.updateNomenclatureCard) {
      // Явное подтверждённое действие пользователя
      await updateNomenclature(
        item.nomenclatureId,
        {
          name: item.name,
          partNumber: item.partNumber ?? null,
          url: item.url ?? null,
          unit: item.unit ?? card.unit,
          lastPrice: item.unitPrice ?? null,
          lastCurrency: item.currency ?? null,
        },
        user,
        "Оновлено із заявки",
      );
      continue;
    }

    // Автоматически заполняем только пустую «последнюю цену», карточку не перезаписываем
    if (card.lastPrice === null && item.unitPrice !== null && item.unitPrice !== undefined) {
      await db
        .update(nomenclature)
        .set({
          lastPrice: String(item.unitPrice),
          lastCurrency: item.currency ?? null,
          lastPriceAt: new Date(),
        })
        .where(eq(nomenclature.id, item.nomenclatureId));
    }
  }
}

async function insertItems(tx: Tx, requestId: number, items: ResolvedItem[]): Promise<void> {
  for (const [index, item] of items.entries()) {
    const [row] = await tx
      .insert(requestItems)
      .values({
        requestId,
        nomenclatureId: item.nomenclatureId,
        position: index,
        name: item.name,
        partNumber: item.partNumber ?? null,
        quantity: String(item.quantity),
        unit: item.unit || "шт",
        unitPrice: item.unitPrice === null || item.unitPrice === undefined ? null : String(item.unitPrice),
        currency: item.currency ?? null,
        url: item.url ?? null,
        comment: item.comment ?? null,
      })
      .returning({ id: requestItems.id });
    if (item.fileIds?.length) {
      await tx.insert(requestItemImages).values(
        item.fileIds.map((fileId, order) => ({
          requestItemId: row.id,
          fileId,
          sortOrder: order,
        })),
      );
    }
  }
}

async function bumpUsage(nomenclatureIds: number[]): Promise<void> {
  const unique = [...new Set(nomenclatureIds.filter(Boolean))];
  if (!unique.length) return;
  await db
    .update(nomenclature)
    .set({ usageCount: sql`${nomenclature.usageCount} + 1` })
    .where(inArray(nomenclature.id, unique));
}

async function processorUserIds(excludeUserId?: number): Promise<number[]> {
  const rows = await db
    .select({ id: users.id, permissions: roles.permissions })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.isActive, true));
  return rows
    .filter((row) => Array.isArray(row.permissions) && row.permissions.includes("requests.process"))
    .map((row) => row.id)
    .filter((id) => id !== excludeUserId);
}

export async function createRequest(
  payload: RequestPayload,
  user: SessionUser,
): Promise<{ id: number; number: string; status: string }> {
  if (!user.permissions.includes("requests.create")) throw new HttpError(403, "forbidden");
  await assertDirectories(payload.departmentId, payload.workshopId);
  assertRequiredItemFields(payload.items, (await getSettings()).requiredItemFields);

  const items = await resolveNomenclature(payload.items, user);
  const status: RequestStatus = payload.submit ? "submitted" : "draft";
  const idempotencyId = payload.idempotencyKey ? `${user.id}:${payload.idempotencyKey}` : null;

  // Защита от повторной отправки одной и той же формы (двойной клик)
  if (idempotencyId) {
    const [claimed] = await db
      .insert(idempotencyKeys)
      .values({ key: idempotencyId, userId: user.id, scope: "request.create" })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });
    if (!claimed) {
      const [existing] = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, idempotencyId))
        .limit(1);
      const stored = existing?.result as { id: number; number: string; status: string } | null;
      if (stored?.id) return stored;
      throw new HttpError(409, "duplicate_submit");
    }
  }

  const created = await db
    .transaction(async (tx) => {
    const number = await nextRequestNumber(tx);
    const [row] = await tx
      .insert(requests)
      .values({
        number,
        authorId: user.id,
        departmentId: payload.departmentId,
        workshopId: payload.workshopId,
        status,
        priority: payload.priority,
        comment: payload.comment ?? null,
        desiredDate: payload.desiredDate ?? null,
        submittedAt: payload.submit ? new Date() : null,
      })
      .returning({ id: requests.id, number: requests.number, status: requests.status });

    await insertItems(tx, row.id, items);
    await tx.insert(requestEvents).values({
      requestId: row.id,
      userId: user.id,
      type: "created",
      toStatus: status,
      message: null,
    });
    if (payload.submit) {
      await tx.insert(requestEvents).values({
        requestId: row.id,
        userId: user.id,
        type: "submitted",
        fromStatus: "draft",
        toStatus: "submitted",
      });
    }
      return row;
    })
    .catch(async (error) => {
      // Освобождаем ключ, чтобы пользователь мог повторить отправку после ошибки
      if (idempotencyId) await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyId));
      throw error;
    });

  await syncCardsFromItems(items, user);
  await bumpUsage(items.map((item) => item.nomenclatureId).filter((id): id is number => Boolean(id)));
  await writeAudit({
    userId: user.id,
    action: payload.submit ? "request.submit" : "request.create",
    entityType: "request",
    entityId: created.id,
    summary: created.number,
  });

  if (payload.submit) {
    const recipients = await processorUserIds(user.id);
    await notify(
      recipients.map((id) => ({
        userId: id,
        requestId: created.id,
        type: "request.submitted",
        title: `Нова заявка ${created.number}`,
        body: `${user.fullName} надіслав(ла) заявку на обробку`,
      })),
    );
  }

  if (idempotencyId) {
    await db.update(idempotencyKeys).set({ result: created }).where(eq(idempotencyKeys.key, idempotencyId));
  }

  void notifyRequestCreated(created.id).catch((err) => {
    console.error("[EMAIL ERROR] notifyRequestCreated failed:", err);
  });

  return created;
}

export async function updateRequest(
  id: number,
  payload: RequestPayload,
  user: SessionUser,
): Promise<{ id: number; number: string; status: string }> {
  const [current] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");
  if (!canViewRequest(user, current)) throw new HttpError(403, "forbidden");

  const settings = await getSettings();
  const editable = canEditRequest({
    status: current.status as RequestStatus,
    isAuthor: current.authorId === user.id,
    permissions: user.permissions,
    editableStatuses: settings.editableStatuses,
  });
  if (!editable) throw new HttpError(403, "request_locked");
  await assertDirectories(payload.departmentId, payload.workshopId);
  assertRequiredItemFields(payload.items, settings.requiredItemFields);

  const items = await resolveNomenclature(payload.items, user);
  const shouldSubmit = payload.submit && current.status === "draft";

  await db.transaction(async (tx) => {
    await tx.delete(requestItems).where(eq(requestItems.requestId, id));
    await insertItems(tx, id, items);
    await tx
      .update(requests)
      .set({
        departmentId: payload.departmentId,
        workshopId: payload.workshopId,
        priority: payload.priority,
        comment: payload.comment ?? null,
        desiredDate: payload.desiredDate ?? null,
        status: shouldSubmit ? "submitted" : current.status,
        submittedAt: shouldSubmit ? new Date() : current.submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(requests.id, id));
    await tx.insert(requestEvents).values({
      requestId: id,
      userId: user.id,
      type: "edit",
      message: `Оновлено склад заявки (${items.length} поз.)`,
    });
    if (shouldSubmit) {
      await tx.insert(requestEvents).values({
        requestId: id,
        userId: user.id,
        type: "submitted",
        fromStatus: "draft",
        toStatus: "submitted",
      });
    }
  });

  await syncCardsFromItems(items, user);
  await writeAudit({
    userId: user.id,
    action: "request.update",
    entityType: "request",
    entityId: id,
    summary: current.number,
  });

  if (shouldSubmit) {
    const recipients = await processorUserIds(user.id);
    await notify(
      recipients.map((recipient) => ({
        userId: recipient,
        requestId: id,
        type: "request.submitted",
        title: `Нова заявка ${current.number}`,
        body: `${user.fullName} надіслав(ла) заявку на обробку`,
      })),
    );
  }

  return { id, number: current.number, status: shouldSubmit ? "submitted" : current.status };
}

export async function changeRequestStatus(
  id: number,
  nextStatus: RequestStatus,
  comment: string | null,
  user: SessionUser,
): Promise<void> {
  const [current] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");
  if (!canViewRequest(user, current)) throw new HttpError(403, "forbidden");

  const actors = actorsFor(user, current);
  if (!actors.length) throw new HttpError(403, "forbidden");

  const check = checkTransition(current.status as RequestStatus, nextStatus, actors, comment);
  if (!check.allowed) {
    throw new HttpError(check.reason === "comment_required" ? 422 : 409, check.reason);
  }

  const isTerminal = TERMINAL_STATUSES.includes(nextStatus);
  await db.transaction(async (tx) => {
    await tx
      .update(requests)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
        closedAt: isTerminal ? new Date() : null,
        assigneeId:
          nextStatus === "in_review" && !current.assigneeId && user.permissions.includes("requests.process")
            ? user.id
            : current.assigneeId,
      })
      .where(eq(requests.id, id));
    await tx.insert(requestEvents).values({
      requestId: id,
      userId: user.id,
      type: nextStatus === "needs_info" ? "clarification" : "status_change",
      fromStatus: current.status,
      toStatus: nextStatus,
      message: comment ?? null,
    });
  });

  await writeAudit({
    userId: user.id,
    action: "request.status",
    entityType: "request",
    entityId: id,
    summary: `${current.number}: ${current.status} → ${nextStatus}`,
    payload: { comment },
  });

  const STATUS_LABELS: Record<string, string> = {
    draft: "Чернетка",
    submitted: "Надіслана на розгляд",
    in_review: "Прийнята в обробку",
    needs_info: "Потребує уточнення",
    purchasing: "Передано в закупівлю",
    ordered: "Замовлено у постачальника",
    completed: "Виконано",
    rejected: "Відхилено",
    cancelled: "Скасовано",
  };
  const statusLabel = STATUS_LABELS[nextStatus] ?? nextStatus;

  const recipients = new Set<number>();
  if (current.authorId !== user.id) recipients.add(current.authorId);
  if (current.assigneeId && current.assigneeId !== user.id) recipients.add(current.assigneeId);
  await notify(
    [...recipients].map((recipient) => ({
      userId: recipient,
      requestId: id,
      type: "request.status",
      title: `Заявка ${current.number}: ${statusLabel}`,
      body: comment?.trim() || `${user.fullName} змінив(ла) статус на «${statusLabel}»`,
    })),
  );

  void notifyStatusChanged({
    requestId: id,
    fromStatus: current.status,
    toStatus: nextStatus,
    comment,
    changedByUserId: user.id,
  }).catch((err) => {
    console.error("[EMAIL ERROR] notifyStatusChanged failed:", err);
  });
}

export async function addRequestComment(
  id: number,
  message: string,
  type: "comment" | "answer",
  user: SessionUser,
): Promise<void> {
  const [current] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");
  if (!canViewRequest(user, current)) throw new HttpError(403, "forbidden");

  await db.insert(requestEvents).values({
    requestId: id,
    userId: user.id,
    type,
    message,
  });

  const recipients = new Set<number>();
  if (current.authorId !== user.id) recipients.add(current.authorId);
  if (current.assigneeId && current.assigneeId !== user.id) recipients.add(current.assigneeId);
  await notify(
    [...recipients].map((recipient) => ({
      userId: recipient,
      requestId: id,
      type: type === "answer" ? "request.answer" : "request.comment",
      title: type === "answer"
        ? `Заявка ${current.number}: відповідь на запит`
        : `Заявка ${current.number}: новий коментар`,
      body: `${user.fullName}: ${message.slice(0, 300)}`,
    })),
  );
}

export async function assignRequest(id: number, assigneeId: number | null, user: SessionUser): Promise<void> {
  if (!user.permissions.includes("requests.assign")) throw new HttpError(403, "forbidden");
  const [current] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");

  if (TERMINAL_STATUSES.includes(current.status as RequestStatus)) {
    throw new HttpError(400, "request_closed");
  }

  if (assigneeId) {
    const [assignee] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    if (!assignee || !assignee.isActive) throw new HttpError(400, "invalid_assignee");
  }

  await db.update(requests).set({ assigneeId, updatedAt: new Date() }).where(eq(requests.id, id));
  await db.insert(requestEvents).values({
    requestId: id,
    userId: user.id,
    type: "assign",
    message: assigneeId ? `Призначено відповідального #${assigneeId}` : "Відповідального знято",
    payload: { assigneeId },
  });
  await writeAudit({
    userId: user.id,
    action: "request.assign",
    entityType: "request",
    entityId: id,
    summary: current.number,
    payload: { assigneeId },
  });
  if (assigneeId && assigneeId !== user.id) {
    await notify({
      userId: assigneeId,
      requestId: id,
      type: "request.assigned",
      title: `Заявка ${current.number}: вас призначено відповідальним`,
      body: `Призначив(ла): ${user.fullName}`,
    });
    void notifyRequestAssigned({
      requestId: id,
      assigneeId,
      assignedByUserId: user.id,
    }).catch((err) => {
      console.error("[EMAIL ERROR] notifyRequestAssigned failed:", err);
    });
  }

  if (assigneeId && current.authorId !== user.id && current.authorId !== assigneeId) {
    const [assignedUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, assigneeId))
      .limit(1);
    if (assignedUser) {
      await notify({
        userId: current.authorId,
        requestId: id,
        type: "request.assigned",
        title: `Заявка ${current.number}: призначено відповідального`,
        body: `Відповідальний за закупівлю: ${assignedUser.fullName}`,
      });
    }
  }
}

/** Разделение заявки: часть позиций переносится в новую заявку с другим цехом/направлением. */
export async function splitRequest(
  id: number,
  itemIds: number[],
  departmentId: number,
  workshopId: number,
  user: SessionUser,
): Promise<{ id: number; number: string }> {
  const [current] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!current) throw new HttpError(404, "not_found");
  const isAuthor = current.authorId === user.id;
  if (!isAuthor && !user.permissions.includes("requests.process")) throw new HttpError(403, "forbidden");
  if (TERMINAL_STATUSES.includes(current.status as RequestStatus)) throw new HttpError(409, "request_closed");
  await assertDirectories(departmentId, workshopId);

  const items = await db
    .select()
    .from(requestItems)
    .where(and(eq(requestItems.requestId, id), inArray(requestItems.id, itemIds)));
  if (items.length !== itemIds.length) throw new HttpError(400, "invalid_items");

  const [{ value: totalItems } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(requestItems)
    .where(eq(requestItems.requestId, id));
  if (totalItems <= items.length) throw new HttpError(400, "cannot_split_all");

  const result = await db.transaction(async (tx) => {
    const number = await nextRequestNumber(tx);
    const [child] = await tx
      .insert(requests)
      .values({
        number,
        authorId: current.authorId,
        departmentId,
        workshopId,
        status: current.status === "draft" ? "draft" : "submitted",
        priority: current.priority,
        comment: current.comment,
        desiredDate: current.desiredDate,
        parentRequestId: current.id,
        submittedAt: current.status === "draft" ? null : new Date(),
      })
      .returning({ id: requests.id, number: requests.number });

    await tx
      .update(requestItems)
      .set({ requestId: child.id })
      .where(inArray(requestItems.id, itemIds));

    await tx.insert(requestEvents).values([
      {
        requestId: current.id,
        userId: user.id,
        type: "split",
        message: `Позиції перенесено до заявки ${child.number}`,
        payload: { childId: child.id, itemIds },
      },
      {
        requestId: child.id,
        userId: user.id,
        type: "created",
        message: `Виділена із заявки ${current.number}`,
        toStatus: current.status === "draft" ? "draft" : "submitted",
      },
    ]);
    return child;
  });

  await writeAudit({
    userId: user.id,
    action: "request.split",
    entityType: "request",
    entityId: current.id,
    summary: `${current.number} → ${result.number}`,
    payload: { itemIds },
  });
  return result;
}

export type RequestFilters = {
  scope: "own" | "all";
  status?: string;
  departmentId?: number;
  workshopId?: number;
  authorId?: number;
  assigneeId?: number;
  priority?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function listRequests(user: SessionUser, filters: RequestFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 5), 100);
  const conditions: SQL[] = [];

  if (filters.scope === "own") {
    conditions.push(eq(requests.authorId, user.id));
  } else {
    const visibility: SQL[] = [eq(requests.authorId, user.id), eq(requests.assigneeId, user.id)];
    if (user.permissions.includes("requests.view_all")) {
      visibility.length = 0;
    } else if (user.permissions.includes("requests.view_workshop") && user.workshopId) {
      visibility.push(eq(requests.workshopId, user.workshopId));
    }
    if (visibility.length) {
      const combined = or(...visibility);
      if (combined) conditions.push(combined);
    }
  }

  if (filters.status && filters.status !== "all") conditions.push(eq(requests.status, filters.status));
  if (filters.departmentId) conditions.push(eq(requests.departmentId, filters.departmentId));
  if (filters.workshopId) conditions.push(eq(requests.workshopId, filters.workshopId));
  if (filters.authorId) conditions.push(eq(requests.authorId, filters.authorId));
  if (filters.assigneeId) conditions.push(eq(requests.assigneeId, filters.assigneeId));
  if (filters.priority && filters.priority !== "all") conditions.push(eq(requests.priority, filters.priority));
  if (filters.dateFrom) conditions.push(gte(requests.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(requests.createdAt, new Date(`${filters.dateTo}T23:59:59.999Z`)));
  if (filters.query) {
    const likePattern = `%${filters.query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    const search = or(
      like(requests.number, likePattern),
      like(sql`lower(coalesce(${requests.comment}, ''))`, likePattern.toLowerCase()),
      sql`exists (
        select 1 from users u
        where u.id = ${requests.authorId}
          and lower(u.full_name) like ${likePattern.toLowerCase()}
      )`,
      sql`exists (
        select 1 from request_items ri
        left join nomenclature n on n.id = ri.nomenclature_id
        where ri.request_id = ${requests.id}
          and (
            lower(ri.name) like ${likePattern.toLowerCase()}
            or lower(coalesce(ri.part_number, '')) like ${likePattern.toLowerCase()}
            or lower(coalesce(n.bas_code, '')) like ${likePattern.toLowerCase()}
            or lower(coalesce(n.manufacturer, '')) like ${likePattern.toLowerCase()}
          )
      )`,
    );
    if (search) conditions.push(search);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  let orderClause: SQL = desc(requests.createdAt);
  if (filters.sort === "updated_desc") {
    orderClause = desc(requests.updatedAt);
  } else if (filters.sort === "priority_desc") {
    orderClause = sql`case ${requests.priority} when 'urgent' then 1 when 'high' then 2 else 3 end asc, ${requests.createdAt} desc`;
  } else if (filters.sort === "number_desc") {
    orderClause = desc(requests.number);
  } else if (filters.sort === "created_asc") {
    orderClause = asc(requests.createdAt);
  }

  const rows = await db
    .select({
      id: requests.id,
      number: requests.number,
      status: requests.status,
      priority: requests.priority,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      desiredDate: requests.desiredDate,
      departmentId: requests.departmentId,
      workshopId: requests.workshopId,
      departmentCode: departments.code,
      departmentNameRu: departments.nameRu,
      departmentNameUk: departments.nameUk,
      workshopCode: workshops.code,
      workshopNameRu: workshops.nameRu,
      workshopNameUk: workshops.nameUk,
      authorId: requests.authorId,
      authorName: users.fullName,
      assigneeId: requests.assigneeId,
      itemCount: sql<number>`(select count(*) from request_items ri where ri.request_id = ${requests.id})`,
    })
    .from(requests)
    .innerJoin(departments, eq(departments.id, requests.departmentId))
    .innerJoin(workshops, eq(workshops.id, requests.workshopId))
    .innerJoin(users, eq(users.id, requests.authorId))
    .where(where)
    .orderBy(orderClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ value: total } = { value: 0 }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(requests)
    .where(where);

  const totals = rows.length
    ? await db
        .select({
          requestId: requestItems.requestId,
          currency: requestItems.currency,
          total: sql<string>`sum(${requestItems.quantity} * coalesce(${requestItems.unitPrice}, 0))`,
        })
        .from(requestItems)
        .where(
          inArray(
            requestItems.requestId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(requestItems.requestId, requestItems.currency)
    : [];

  const totalsByRequest = new Map<number, { currency: string; total: number }[]>();
  for (const row of totals) {
    if (!row.currency) continue;
    const amount = Number(row.total);
    if (!amount) continue;
    const list = totalsByRequest.get(row.requestId) ?? [];
    list.push({ currency: row.currency, total: amount });
    totalsByRequest.set(row.requestId, list);
  }

  return {
    items: rows.map((row) => ({ ...row, totals: totalsByRequest.get(row.id) ?? [] })),
    total,
    page,
    pageSize,
  };
}

export async function getRequestDetail(id: number, user: SessionUser) {
  const [row] = await db
    .select({
      request: requests,
      departmentCode: departments.code,
      departmentNameRu: departments.nameRu,
      departmentNameUk: departments.nameUk,
      workshopCode: workshops.code,
      workshopNameRu: workshops.nameRu,
      workshopNameUk: workshops.nameUk,
      authorName: users.fullName,
      authorEmail: users.email,
    })
    .from(requests)
    .innerJoin(departments, eq(departments.id, requests.departmentId))
    .innerJoin(workshops, eq(workshops.id, requests.workshopId))
    .innerJoin(users, eq(users.id, requests.authorId))
    .where(eq(requests.id, id))
    .limit(1);
  if (!row) return null;
  if (!canViewRequest(user, row.request)) throw new HttpError(403, "forbidden");

  const items = await db
    .select({
      id: requestItems.id,
      requestId: requestItems.requestId,
      position: requestItems.position,
      nomenclatureId: requestItems.nomenclatureId,
      name: requestItems.name,
      partNumber: requestItems.partNumber,
      manufacturer: nomenclature.manufacturer,
      quantity: requestItems.quantity,
      unit: requestItems.unit,
      unitPrice: requestItems.unitPrice,
      currency: requestItems.currency,
      url: requestItems.url,
      comment: requestItems.comment,
      createdAt: requestItems.createdAt,
      basCode: nomenclature.basCode,
    })
    .from(requestItems)
    .leftJoin(nomenclature, eq(nomenclature.id, requestItems.nomenclatureId))
    .where(eq(requestItems.requestId, id))
    .orderBy(asc(requestItems.position), asc(requestItems.id));

  const images = items.length
    ? await db
        .select({
          requestItemId: requestItemImages.requestItemId,
          fileId: requestItemImages.fileId,
          sortOrder: requestItemImages.sortOrder,
        })
        .from(requestItemImages)
        .where(
          inArray(
            requestItemImages.requestItemId,
            items.map((item) => item.id),
          ),
        )
        .orderBy(asc(requestItemImages.sortOrder))
    : [];

  const events = await db
    .select({
      id: requestEvents.id,
      type: requestEvents.type,
      fromStatus: requestEvents.fromStatus,
      toStatus: requestEvents.toStatus,
      message: requestEvents.message,
      createdAt: requestEvents.createdAt,
      userName: users.fullName,
      userId: requestEvents.userId,
    })
    .from(requestEvents)
    .leftJoin(users, eq(users.id, requestEvents.userId))
    .where(eq(requestEvents.requestId, id))
    .orderBy(desc(requestEvents.createdAt));

  const assignee = row.request.assigneeId
    ? (
        await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(eq(users.id, row.request.assigneeId))
          .limit(1)
      )[0] ?? null
    : null;

  const children = await db
    .select({ id: requests.id, number: requests.number, status: requests.status })
    .from(requests)
    .where(eq(requests.parentRequestId, id));

  const parent = row.request.parentRequestId
    ? (
        await db
          .select({ id: requests.id, number: requests.number })
          .from(requests)
          .where(eq(requests.id, row.request.parentRequestId))
          .limit(1)
      )[0] ?? null
    : null;

  return {
    ...row.request,
    departmentCode: row.departmentCode,
    departmentNameRu: row.departmentNameRu,
    departmentNameUk: row.departmentNameUk,
    workshopCode: row.workshopCode,
    workshopNameRu: row.workshopNameRu,
    workshopNameUk: row.workshopNameUk,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    assignee,
    items: items.map((item) => ({
      ...item,
      images: images.filter((image) => image.requestItemId === item.id).map((image) => image.fileId),
    })),
    events,
    children,
    parent,
  };
}
