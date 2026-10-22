import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { handleRoute, parseIdParam } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { canAccessFile, readStoredFile } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { id: rawId } = await context.params;
    const id = parseIdParam(rawId);

    const allowed = await canAccessFile(id, user);
    if (!allowed) throw new HttpError(403, "forbidden");

    const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!row) throw new HttpError(404, "not_found");

    const etag = `"${row.checksum || row.id}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch.includes(etag))) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    const buffer = await readStoredFile(row.storageKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Length": String(row.size),
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "ETag": etag,
        "Content-Disposition": `inline; filename="${encodeURIComponent(row.originalName)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
