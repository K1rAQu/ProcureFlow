import { handleRoute, jsonOk } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { storeUpload } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const formData = await request.formData().catch(() => null);
    if (!formData) throw new HttpError(400, "invalid_form");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "file_required");

    const stored = await storeUpload(file, user);
    return jsonOk(
      {
        id: stored.id,
        name: stored.originalName,
        size: stored.size,
        mimeType: stored.mimeType,
        url: `/api/files/${stored.id}`,
      },
      201,
    );
  });
}
