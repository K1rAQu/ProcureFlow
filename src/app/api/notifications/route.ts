import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    return jsonOk({ items: rows, unread: rows.filter((row) => !row.isRead).length });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const body = (await readJson(request)) as { ids?: number[]; all?: boolean };
    if (body.all) {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, user.id));
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, user.id), inArray(notifications.id, body.ids)));
    }
    return jsonOk({ ok: true });
  });
}
