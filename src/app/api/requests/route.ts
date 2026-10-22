import { handleRoute, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requireUser } from "@/lib/auth";
import { assertOwnedFiles } from "@/lib/files";
import { createRequest, listRequests } from "@/lib/requests-service";
import { requestPayloadSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const number = (key: string) => {
      const value = url.searchParams.get(key);
      const parsed = value ? Number(value) : NaN;
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };
    const result = await listRequests(user, {
      scope: url.searchParams.get("scope") === "all" ? "all" : "own",
      status: url.searchParams.get("status") ?? undefined,
      departmentId: number("departmentId"),
      workshopId: number("workshopId"),
      authorId: number("authorId"),
      assigneeId: number("assigneeId"),
      priority: url.searchParams.get("priority") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      page: number("page") ?? 1,
      pageSize: number("pageSize") ?? 20,
    });
    return jsonOk(result);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requirePermission("requests.create");
    const payload = requestPayloadSchema.parse(await readJson(request));
    const fileIds = payload.items.flatMap((item) => item.fileIds ?? []);
    await assertOwnedFiles(fileIds, user);
    const created = await createRequest(payload, user);
    return jsonOk(created, 201);
  });
}
