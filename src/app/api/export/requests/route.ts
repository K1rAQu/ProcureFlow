import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { departments, nomenclature, requestItems, requests, users, workshops } from "@/db/schema";
import { handleRoute } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_NAMES: Record<string, string> = {
  draft: "Чернетка",
  submitted: "Надіслана",
  in_review: "Прийнята в обробку",
  needs_info: "Потребує уточнення",
  purchasing: "У процесі закупівлі",
  ordered: "Закуплена / замовлена",
  completed: "Завершена",
  rejected: "Відхилена",
  cancelled: "Скасована",
};

const PRIORITY_NAMES: Record<string, string> = {
  normal: "Звичайний",
  high: "Високий",
  urgent: "Терміновий",
};

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
  return `"${str}"`;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const mineOnly = url.searchParams.get("mine") === "1";
    const statusParam = url.searchParams.get("status");
    const priorityParam = url.searchParams.get("priority");
    const query = url.searchParams.get("q")?.trim();

    const conditions: SQL[] = [];

    if (mineOnly || !user.permissions.includes("requests.view_all")) {
      if (user.permissions.includes("requests.view_workshop") && user.workshopId && !mineOnly) {
        conditions.push(
          or(
            eq(requests.authorId, user.id),
            eq(requests.workshopId, user.workshopId),
            eq(requests.assigneeId, user.id),
          )!,
        );
      } else {
        conditions.push(eq(requests.authorId, user.id));
      }
    }

    if (statusParam && statusParam !== "all") {
      conditions.push(eq(requests.status, statusParam));
    }
    if (priorityParam && priorityParam !== "all") {
      conditions.push(eq(requests.priority, priorityParam));
    }
    if (query) {
      conditions.push(
        or(
          like(requests.number, `%${query}%`),
          like(requests.comment, `%${query}%`),
        )!,
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const requestRows = await db
      .select({
        id: requests.id,
        number: requests.number,
        status: requests.status,
        priority: requests.priority,
        comment: requests.comment,
        desiredDate: requests.desiredDate,
        createdAt: requests.createdAt,
        authorName: users.fullName,
        authorEmail: users.email,
        departmentNameUk: departments.nameUk,
        workshopNameUk: workshops.nameUk,
        assigneeId: requests.assigneeId,
      })
      .from(requests)
      .innerJoin(users, eq(users.id, requests.authorId))
      .innerJoin(departments, eq(departments.id, requests.departmentId))
      .innerJoin(workshops, eq(workshops.id, requests.workshopId))
      .where(where)
      .orderBy(desc(requests.createdAt))
      .limit(2000);

    if (!requestRows.length) {
      const emptyCsv = "\uFEFFНомер заявки;Дата;Статус;Пріоритет;Відділ;Цех;Автор;Email;Позиція;Кількість;Од. вим.;Ціна;Валюта;Сума;Коментар\n";
      return new Response(emptyCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="requests-export.csv"',
        },
      });
    }

    const reqIds = requestRows.map((r) => r.id);
    const itemRows = await db
      .select({
        requestId: requestItems.requestId,
        name: requestItems.name,
        partNumber: requestItems.partNumber,
        basCode: nomenclature.basCode,
        quantity: requestItems.quantity,
        unit: requestItems.unit,
        unitPrice: requestItems.unitPrice,
        currency: requestItems.currency,
        url: requestItems.url,
        comment: requestItems.comment,
      })
      .from(requestItems)
      .leftJoin(nomenclature, eq(nomenclature.id, requestItems.nomenclatureId))
      .where(inArray(requestItems.requestId, reqIds));

    const itemsByReq = new Map<number, typeof itemRows>();
    for (const item of itemRows) {
      const arr = itemsByReq.get(item.requestId) ?? [];
      arr.push(item);
      itemsByReq.set(item.requestId, arr);
    }

    // Збираємо імена призначених закупників
    const assigneeIds = Array.from(new Set(requestRows.map((r) => r.assigneeId).filter(Boolean))) as number[];
    const assigneeMap = new Map<number, string>();
    if (assigneeIds.length) {
      const assignees = await db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, assigneeIds));
      for (const a of assignees) assigneeMap.set(a.id, a.name);
    }

    const header = [
      "Номер заявки",
      "Дата створення",
      "Статус",
      "Пріоритет",
      "Напрям закупівлі",
      "Цех",
      "Автор",
      "Email автора",
      "Відповідальний закупник",
      "Бажана дата",
      "Найменування позиції",
      "Артикул / Part No",
      "Артикул 1С",
      "Кількість",
      "Од. вим.",
      "Орієнтовна ціна",
      "Валюта",
      "Орієнтовна сума",
      "Посилання на товар",
      "Коментар до позиції",
      "Коментар до заявки",
    ];

    const lines: string[] = [header.map(escapeCsv).join(";")];

    for (const req of requestRows) {
      const reqItems = itemsByReq.get(req.id) ?? [];
      const dateStr = req.createdAt ? new Date(req.createdAt).toISOString().slice(0, 10) : "";
      const statusTitle = STATUS_NAMES[req.status] ?? req.status;
      const priorityTitle = PRIORITY_NAMES[req.priority] ?? req.priority;
      const assigneeName = req.assigneeId ? assigneeMap.get(req.assigneeId) ?? "—" : "—";

      if (!reqItems.length) {
        lines.push(
          [
            req.number,
            dateStr,
            statusTitle,
            priorityTitle,
            req.departmentNameUk,
            req.workshopNameUk,
            req.authorName,
            req.authorEmail,
            assigneeName,
            req.desiredDate ?? "",
            "—",
            "—",
            "—",
            "0",
            "—",
            "—",
            "—",
            "—",
            "—",
            "—",
            req.comment ?? "",
          ]
            .map(escapeCsv)
            .join(";"),
        );
      } else {
        for (const item of reqItems) {
          const priceNum = item.unitPrice ? parseFloat(item.unitPrice) : 0;
          const qtyNum = item.quantity ? parseFloat(item.quantity) : 0;
          const sumStr = priceNum > 0 && qtyNum > 0 ? (priceNum * qtyNum).toFixed(2) : "";

          lines.push(
            [
              req.number,
              dateStr,
              statusTitle,
              priorityTitle,
              req.departmentNameUk,
              req.workshopNameUk,
              req.authorName,
              req.authorEmail,
              assigneeName,
              req.desiredDate ?? "",
              item.name,
              item.partNumber ?? "",
              item.basCode ?? "",
              item.quantity,
              item.unit,
              item.unitPrice ?? "",
              item.currency ?? "",
              sumStr,
              item.url ?? "",
              item.comment ?? "",
              req.comment ?? "",
            ]
              .map(escapeCsv)
              .join(";"),
          );
        }
      }
    }

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="procurement-requests-${today}.csv"`,
      },
    });
  });
}
