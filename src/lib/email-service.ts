import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/db";
import { departments, requestItems, requests, roles, users, workshops } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { formatDateTime, formatQuantity } from "./format";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "Система закупівель <noreply@procurement.local>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_HOST) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return cachedTransporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const recipients = Array.isArray(to) ? to : [to];
  const validRecipients = recipients.filter((email) => typeof email === "string" && email.includes("@"));
  if (!validRecipients.length) return false;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[EMAIL LOG - DEV MODE]\nTo: ${validRecipients.join(", ")}\nSubject: ${subject}\n---\n${text || html.replace(/<[^>]+>/g, " ").slice(0, 300)}...\n`,
    );
    return true;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: validRecipients.join(", "),
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, " "),
    });
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send to ${validRecipients.join(", ")}:`, error);
    return false;
  }
}

export const STATUS_LABELS_UK: Record<string, string> = {
  draft: "Чернетка",
  submitted: "Подано на погодження",
  in_review: "Взято в обробку",
  needs_info: "Запит уточнення",
  purchasing: "Передано в закупівлю",
  ordered: "Замовлено",
  completed: "Виконано",
  rejected: "Відхилено",
  cancelled: "Скасовано",
};

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailTemplate({
  title,
  preheader,
  contentHtml,
  actionText,
  actionUrl,
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  actionText?: string;
  actionUrl?: string;
}) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const safeActionText = escapeHtml(actionText);

  return `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  ${safePreheader ? `<span style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${safePreheader}</span>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" cellpadding="0" cellspacing="0">
          <!-- Хедер -->
          <tr>
            <td style="background-color:#12325c;padding:24px 32px;text-align:left;">
              <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#ffffff;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;text-transform:uppercase;letter-spacing:0.05em;">Закупівлі</span>
              <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:12px 0 0 0;line-height:1.3;">${safeTitle}</h1>
            </td>
          </tr>
          <!-- Тіло -->
          <tr>
            <td style="padding:32px;font-size:14px;line-height:1.6;color:#334155;">
              ${contentHtml}
              ${
                safeActionText && actionUrl
                  ? `
                <div style="margin-top:28px;text-align:left;">
                  <a href="${actionUrl}" style="display:inline-block;background-color:#12325c;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;padding:12px 24px;border-radius:8px;box-shadow:0 1px 2px 0 rgba(0,0,0,0.05);">${safeActionText} →</a>
                </div>
              `
                  : ""
              }
            </td>
          </tr>
          <!-- Футер -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
              <p style="margin:0;">Система керування закупівлями підприємства · Автоматичне сповіщення</p>
              <p style="margin:4px 0 0 0;font-size:11px;color:#94a3b8;">Будь ласка, не відповідайте на цей лист прямо, перейдіть до системи для комунікації.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function notifyRequestCreated(requestId: number): Promise<void> {
  const [row] = await db
    .select({
      id: requests.id,
      number: requests.number,
      status: requests.status,
      priority: requests.priority,
      comment: requests.comment,
      createdAt: requests.createdAt,
      authorName: users.fullName,
      authorEmail: users.email,
      departmentName: departments.nameUk,
      workshopName: workshops.nameUk,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.authorId))
    .innerJoin(departments, eq(departments.id, requests.departmentId))
    .innerJoin(workshops, eq(workshops.id, requests.workshopId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return;

  const items = await db
    .select({
      name: requestItems.name,
      partNumber: requestItems.partNumber,
      quantity: requestItems.quantity,
      unit: requestItems.unit,
      comment: requestItems.comment,
    })
    .from(requestItems)
    .where(eq(requestItems.requestId, requestId));

  const itemsHtml = `
    <table width="100%" style="margin-top:16px;border-collapse:collapse;font-size:12px;border:1px solid #cbd5e1;" cellpadding="8">
      <thead>
        <tr style="background-color:#f1f5f9;color:#0f172a;text-align:left;">
          <th style="border:1px solid #cbd5e1;">№</th>
          <th style="border:1px solid #cbd5e1;">Найменування</th>
          <th style="border:1px solid #cbd5e1;">Артикул</th>
          <th style="border:1px solid #cbd5e1;text-align:right;">Кількість</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item, index) => `
          <tr style="border:1px solid #e2e8f0;">
            <td style="border:1px solid #e2e8f0;text-align:center;">${index + 1}</td>
            <td style="border:1px solid #e2e8f0;font-weight:600;color:#0f172a;">
              ${escapeHtml(item.name)}
              ${item.comment ? `<div style="color:#64748b;font-size:11px;font-style:italic;">${escapeHtml(item.comment)}</div>` : ""}
            </td>
            <td style="border:1px solid #e2e8f0;color:#475569;">${escapeHtml(item.partNumber || "—")}</td>
            <td style="border:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  const requestUrl = `${APP_URL}/requests/${row.id}`;

  // Лист автору
  const authorHtml = emailTemplate({
    title: `Заявку № ${escapeHtml(row.number)} успішно зареєстровано`,
    preheader: `Ваша заявка на закупівлю № ${escapeHtml(row.number)} передана в систему`,
    contentHtml: `
      <p style="margin:0 0 12px 0;">Вітаємо, <strong>${escapeHtml(row.authorName)}</strong>!</p>
      <p style="margin:0 0 12px 0;">Ваша заявка на закупівлю <strong>№ ${escapeHtml(row.number)}</strong> успішно створена та надійшла на обробку до відділу постачання.</p>
      <div style="background-color:#f8fafc;border-left:4px solid #12325c;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 4px 0;"><strong>Напрям:</strong> ${escapeHtml(row.departmentName)}</p>
        <p style="margin:0 0 4px 0;"><strong>Цех / ділянка:</strong> ${escapeHtml(row.workshopName)}</p>
        <p style="margin:0 0 4px 0;"><strong>Позицій у заявці:</strong> ${items.length}</p>
        <p style="margin:0;"><strong>Поточний статус:</strong> ${escapeHtml(STATUS_LABELS_UK[row.status] || row.status)}</p>
      </div>
      <h3 style="font-size:14px;color:#0f172a;margin:20px 0 8px 0;">Перелік товарів:</h3>
      ${itemsHtml}
    `,
    actionText: "Переглянути заявку",
    actionUrl: requestUrl,
  });

  await sendEmail({
    to: row.authorEmail,
    subject: `Заявка успішно створена: № ${row.number}`,
    html: authorHtml,
  });

  // Лист відповідальним за закупівлі (фахівцям відділу)
  const processors = await db
    .select({ email: users.email })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.isActive, true));

  const processorEmails = processors
    .map((p) => p.email)
    .filter((e) => e && e !== row.authorEmail);

  if (processorEmails.length > 0) {
    const processorHtml = emailTemplate({
      title: `Нова заявка на закупівлю: № ${escapeHtml(row.number)}`,
      preheader: `Створено нову заявку від ${escapeHtml(row.authorName)} (${escapeHtml(row.workshopName)})`,
      contentHtml: `
        <p style="margin:0 0 12px 0;">У системі зареєстровано нову заявку на закупівлю <strong>№ ${escapeHtml(row.number)}</strong>.</p>
        <div style="background-color:#f8fafc;border-left:4px solid #0284c7;padding:12px 16px;border-radius:4px;margin:16px 0;">
          <p style="margin:0 0 4px 0;"><strong>Замовник:</strong> ${escapeHtml(row.authorName)} (${escapeHtml(row.authorEmail)})</p>
          <p style="margin:0 0 4px 0;"><strong>Напрям:</strong> ${escapeHtml(row.departmentName)}</p>
          <p style="margin:0 0 4px 0;"><strong>Цех:</strong> ${escapeHtml(row.workshopName)}</p>
          <p style="margin:0;"><strong>Кількість позицій:</strong> ${items.length}</p>
        </div>
        ${row.comment ? `<p style="margin:12px 0;background:#fefce8;padding:10px 14px;border-radius:6px;color:#854d0e;"><strong>Коментар замовника:</strong> ${escapeHtml(row.comment)}</p>` : ""}
        <h3 style="font-size:14px;color:#0f172a;margin:20px 0 8px 0;">Специфікація:</h3>
        ${itemsHtml}
      `,
      actionText: "Взяти в обробку",
      actionUrl: requestUrl,
    });

    await sendEmail({
      to: processorEmails,
      subject: `Нова заявка на закупівлю: № ${row.number} (${row.workshopName})`,
      html: processorHtml,
    });
  }
}

/**
 * 2. Сповіщення про зміну статусу заявки
 */
export async function notifyStatusChanged({
  requestId,
  fromStatus,
  toStatus,
  comment,
  changedByUserId,
}: {
  requestId: number;
  fromStatus: string;
  toStatus: string;
  comment?: string | null;
  changedByUserId: number;
}): Promise<void> {
  const [row] = await db
    .select({
      id: requests.id,
      number: requests.number,
      authorId: requests.authorId,
      assigneeId: requests.assigneeId,
      authorEmail: users.email,
      authorName: users.fullName,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.authorId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return;

  const [changer] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, changedByUserId))
    .limit(1);

  const changerName = changer?.fullName ?? "Система";
  const toStatusTitle = STATUS_LABELS_UK[toStatus] || toStatus;
  const fromStatusTitle = STATUS_LABELS_UK[fromStatus] || fromStatus;
  const requestUrl = `${APP_URL}/requests/${row.id}`;

  const recipients = new Set<string>();
  if (row.authorEmail) recipients.add(row.authorEmail);

  if (row.assigneeId && row.assigneeId !== changedByUserId) {
    const [assignee] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, row.assigneeId))
      .limit(1);
    if (assignee?.email) recipients.add(assignee.email);
  }

  const isNeedsInfo = toStatus === "needs_info";
  const isRejected = toStatus === "rejected";
  const isCompleted = toStatus === "completed";

  let statusBadgeColor = "#0284c7"; // default blue
  if (isCompleted) statusBadgeColor = "#16a34a"; // green
  if (isNeedsInfo) statusBadgeColor = "#d97706"; // amber
  if (isRejected) statusBadgeColor = "#dc2626"; // red

  const html = emailTemplate({
    title: `Статус заявки № ${escapeHtml(row.number)} змінено`,
    preheader: `Новий статус: ${escapeHtml(toStatusTitle)} · Заявка № ${escapeHtml(row.number)}`,
    contentHtml: `
      <p style="margin:0 0 16px 0;">Доброго дня!</p>
      <p style="margin:0 0 16px 0;">У заявці на закупівлю <strong>№ ${escapeHtml(row.number)}</strong> відбулася зміна статусу.</p>

      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;padding:16px;border-radius:8px;margin:16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
          <tr>
            <td style="color:#64748b;padding-bottom:6px;">Попередній статус:</td>
            <td style="font-weight:600;color:#475569;padding-bottom:6px;">${escapeHtml(fromStatusTitle)}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding-bottom:6px;">Новий статус:</td>
            <td style="padding-bottom:6px;">
              <span style="display:inline-block;background-color:${statusBadgeColor};color:#ffffff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px;">
                ${escapeHtml(toStatusTitle)}
              </span>
            </td>
          </tr>
          <tr>
            <td style="color:#64748b;">Змінив:</td>
            <td style="font-weight:600;color:#0f172a;">${escapeHtml(changerName)}</td>
          </tr>
        </table>
      </div>

      ${
        comment
          ? `
        <div style="background-color:#fefce8;border:1px solid #fef08a;border-left:4px solid #ca8a04;padding:12px 16px;border-radius:6px;margin:16px 0;color:#713f12;">
          <p style="margin:0 0 4px 0;font-weight:700;font-size:12px;text-transform:uppercase;">Коментар / Причина:</p>
          <p style="margin:0;font-style:italic;line-height:1.5;">«${escapeHtml(comment)}»</p>
        </div>
      `
          : ""
      }

      ${
        isNeedsInfo
          ? `
        <p style="color:#b45309;font-weight:600;margin:16px 0 0 0;">
          ⚠️ Зверніть увагу: фахівець із закупівель очікує відповідь або коригування складу заявки. Перейдіть до заявки, внесіть зміни та поверніть її в обробку.
        </p>
      `
          : ""
      }
    `,
    actionText: isNeedsInfo ? "Переглянути та відредагувати" : "Відкрити заявку",
    actionUrl: requestUrl,
  });

  await sendEmail({
    to: [...recipients],
    subject: `Оновлення статусу заявки № ${row.number}: ${toStatusTitle}`,
    html,
  });
}

/**
 * 3. Сповіщення про призначення відповідального
 */
export async function notifyRequestAssigned({
  requestId,
  assigneeId,
  assignedByUserId,
}: {
  requestId: number;
  assigneeId: number;
  assignedByUserId: number;
}): Promise<void> {
  const [row] = await db
    .select({
      id: requests.id,
      number: requests.number,
      authorName: users.fullName,
      workshopName: workshops.nameUk,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.authorId))
    .innerJoin(workshops, eq(workshops.id, requests.workshopId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return;

  const [assignee] = await db
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1);

  if (!assignee?.email) return;

  const [changer] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, assignedByUserId))
    .limit(1);

  const requestUrl = `${APP_URL}/requests/${row.id}`;

  const html = emailTemplate({
    title: `Вам призначено заявку № ${escapeHtml(row.number)}`,
    preheader: `Вас призначено відповідальним за заявку № ${escapeHtml(row.number)} (${escapeHtml(row.workshopName)})`,
    contentHtml: `
      <p style="margin:0 0 12px 0;">Вітаємо, <strong>${escapeHtml(assignee.fullName)}</strong>!</p>
      <p style="margin:0 0 12px 0;">Вас призначено відповідальним виконавцем за заявкою на закупівлю <strong>№ ${escapeHtml(row.number)}</strong>.</p>
      <div style="background-color:#f8fafc;border-left:4px solid #12325c;padding:12px 16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 4px 0;"><strong>Замовник:</strong> ${escapeHtml(row.authorName)}</p>
        <p style="margin:0 0 4px 0;"><strong>Цех:</strong> ${escapeHtml(row.workshopName)}</p>
        <p style="margin:0;"><strong>Призначив:</strong> ${escapeHtml(changer?.fullName ?? "Адміністратор")}</p>
      </div>
    `,
    actionText: "Відкрити заявку",
    actionUrl: requestUrl,
  });

  await sendEmail({
    to: assignee.email,
    subject: `Вам призначено заявку на закупівлю № ${row.number}`,
    html,
  });
}
