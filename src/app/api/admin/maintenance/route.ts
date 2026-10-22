import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { and, inArray, lte, sql } from "drizzle-orm";
import { client, db } from "@/db";
import { files, nomenclature, requests, sessions } from "@/db/schema";
import { handleRoute, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { TERMINAL_STATUSES } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    await requirePermission("admin.settings");

    const dbPath = resolve(process.cwd(), "data", "procurement.db");
    const fileStats = await stat(dbPath).catch(() => null);
    const dbSizeBytes = fileStats?.size ?? 0;

    const [filesRow] = await db
      .select({
        count: sql<number>`count(*)`,
        totalSize: sql<number>`coalesce(sum(${files.size}), 0)`,
      })
      .from(files);

    const [sessionsRow] = await db
      .select({
        expiredCount: sql<number>`count(*)`,
      })
      .from(sessions)
      .where(lte(sessions.expiresAt, new Date()));

    const [requestsRow] = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(requests);

    const [closedReqsRow] = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(requests)
      .where(inArray(requests.status, TERMINAL_STATUSES));

    const [nomRow] = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(nomenclature);

    return jsonOk({
      dbSizeBytes,
      uploadsCount: Number(filesRow?.count ?? 0),
      uploadsSizeBytes: Number(filesRow?.totalSize ?? 0),
      expiredSessionsCount: Number(sessionsRow?.expiredCount ?? 0),
      totalRequests: Number(requestsRow?.total ?? 0),
      closedRequestsCount: Number(closedReqsRow?.total ?? 0),
      totalNomenclature: Number(nomRow?.total ?? 0),
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("admin.settings");
    const body = (await request.json().catch(() => ({}))) as {
      action?: "clean_sessions" | "vacuum";
    };

    if (body.action === "clean_sessions") {
      const before = await db
        .select({ count: sql<number>`count(*)` })
        .from(sessions)
        .where(lte(sessions.expiresAt, new Date()));

      await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));

      await writeAudit({
        userId: user.id,
        action: "maintenance.clean_sessions",
        entityType: "settings",
        summary: `Очищено застарілі сесії (${before[0]?.count ?? 0} шт.)`,
      });

      return jsonOk({ success: true, count: Number(before[0]?.count ?? 0) });
    }

    if (body.action === "vacuum") {
      try {
        await client.execute("PRAGMA wal_checkpoint(TRUNCATE);");
        await client.execute("VACUUM;");
      } catch (err) {
        console.warn("VACUUM execution error:", err);
      }

      await writeAudit({
        userId: user.id,
        action: "maintenance.vacuum",
        entityType: "settings",
        summary: "Виконано оптимізацію та дефрагментацію бази даних (VACUUM)",
      });

      return jsonOk({ success: true });
    }

    return jsonOk({ error: "unknown_action" }, 400);
  });
}
