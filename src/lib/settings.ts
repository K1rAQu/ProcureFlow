import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_EDITABLE_STATUSES, type RequestStatus } from "./workflow";

export type SystemSettings = {
  editableStatuses: RequestStatus[];
  requiredItemFields: ("partNumber" | "unitPrice" | "currency" | "url" | "photo")[];
  autoApproveNomenclature: boolean;
  maxUploadMb: number;
  sessionTimeoutMinutes: number;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  editableStatuses: DEFAULT_EDITABLE_STATUSES,
  requiredItemFields: [],
  autoApproveNomenclature: true,
  maxUploadMb: 8,
  sessionTimeoutMinutes: 30,
};

const SETTINGS_KEY = "system";

export async function getSettings(): Promise<SystemSettings> {
  const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
  const stored = rows[0]?.value as Partial<SystemSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  const current = await getSettings();
  const next: SystemSettings = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  return next;
}
