import "server-only";
import { db } from "@/db";
import { auditLog, notifications } from "@/db/schema";

export type AuditInput = {
  userId: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId === null || input.entityId === undefined ? null : String(input.entityId),
    summary: input.summary ?? null,
    payload: input.payload ?? null,
    ip: input.ip ?? null,
  });
}

export type NotificationInput = {
  userId: number;
  requestId?: number | null;
  type: string;
  title: string;
  body?: string | null;
};

export async function notify(input: NotificationInput | NotificationInput[]): Promise<void> {
  const items = Array.isArray(input) ? input : [input];
  if (!items.length) return;
  await db.insert(notifications).values(
    items.map((item) => ({
      userId: item.userId,
      requestId: item.requestId ?? null,
      type: item.type,
      title: item.title.slice(0, 250),
      body: item.body ?? null,
    })),
  );
}

export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[field] = { from, to };
    }
  }
  return changes;
}
