import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { nomenclature } from "@/db/schema";
import { handleRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_NAMES: Record<string, string> = {
  active: "Активна",
  pending: "На перевірці",
  archived: "В архіві",
  merged: "Об'єднана",
};

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
  return `"${str}"`;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requirePermission("nomenclature.view");
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const query = url.searchParams.get("q")?.trim();

    const conditions: SQL[] = [];

    if (statusParam && statusParam !== "all") {
      conditions.push(eq(nomenclature.status, statusParam));
    }
    if (query) {
      conditions.push(
        or(
          like(nomenclature.name, `%${query}%`),
          like(nomenclature.partNumber, `%${query}%`),
          like(nomenclature.basCode, `%${query}%`),
          like(nomenclature.manufacturer, `%${query}%`),
        )!,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: nomenclature.id,
        name: nomenclature.name,
        partNumber: nomenclature.partNumber,
        basCode: nomenclature.basCode,
        manufacturer: nomenclature.manufacturer,
        unit: nomenclature.unit,
        status: nomenclature.status,
        lastPrice: nomenclature.lastPrice,
        lastCurrency: nomenclature.lastCurrency,
        usageCount: nomenclature.usageCount,
        description: nomenclature.description,
        specs: nomenclature.specs,
        url: nomenclature.url,
        updatedAt: nomenclature.updatedAt,
      })
      .from(nomenclature)
      .where(where)
      .orderBy(desc(nomenclature.usageCount), desc(nomenclature.updatedAt))
      .limit(5000);

    const header = [
      "ID",
      "Найменування номенклатури",
      "Артикул / Part No",
      "Код БАС / 1С",
      "Виробник / Бренд",
      "Одиниця виміру",
      "Статус",
      "Остання ціна",
      "Валюта",
      "Кількість замовлень",
      "Опис",
      "Характеристики",
      "Посилання на товар",
      "Дата оновлення",
    ];

    const lines: string[] = [header.map(escapeCsv).join(";")];

    for (const r of rows) {
      const dateStr = r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : "";
      const statusTitle = STATUS_NAMES[r.status] ?? r.status;

      lines.push(
        [
          r.id,
          r.name,
          r.partNumber ?? "",
          r.basCode ?? "",
          r.manufacturer ?? "",
          r.unit,
          statusTitle,
          r.lastPrice ?? "",
          r.lastCurrency ?? "",
          r.usageCount,
          r.description ?? "",
          r.specs ?? "",
          r.url ?? "",
          dateStr,
        ]
          .map(escapeCsv)
          .join(";"),
      );
    }

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nomenclature-${today}.csv"`,
      },
    });
  });
}
