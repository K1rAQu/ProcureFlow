import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getSettings, saveSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("admin.settings");
    return jsonOk(await getSettings());
  });
}

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const admin = await requirePermission("admin.settings");
    const payload = settingsSchema.parse(await readJson(request));
    const next = await saveSettings(payload);
    await writeAudit({
      userId: admin.id,
      action: "settings.update",
      entityType: "settings",
      entityId: "system",
      summary: "Оновлено налаштування системи",
      payload: next as unknown as Record<string, unknown>,
    });
    return jsonOk(next);
  });
}
