import { handleRoute, jsonOk } from "@/lib/api";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST() {
  return handleRoute(async () => {
    const user = await getCurrentUser();
    await destroySession();
    if (user) {
      await writeAudit({
        userId: user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: user.id,
        summary: user.email,
      });
    }
    return jsonOk({ ok: true });
  });
}
