import type { Permission } from "./permissions";

export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "needs_info",
  "purchasing",
  "ordered",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TERMINAL_STATUSES: RequestStatus[] = ["completed", "rejected", "cancelled"];

export const PRIORITIES = ["normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CURRENCIES = ["UAH", "USD", "EUR", "PLN", "CNY", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Actor = "author" | "processor";

type Transition = {
  to: RequestStatus;
  actors: Actor[];

  requiresComment?: boolean;
};

export const TRANSITIONS: Record<RequestStatus, Transition[]> = {
  draft: [
    { to: "submitted", actors: ["author"] },
    { to: "cancelled", actors: ["author", "processor"] },
  ],
  submitted: [
    { to: "in_review", actors: ["processor"] },
    { to: "needs_info", actors: ["processor"], requiresComment: true },
    { to: "rejected", actors: ["processor"], requiresComment: true },
    { to: "cancelled", actors: ["author", "processor"] },
  ],
  in_review: [
    { to: "needs_info", actors: ["processor"], requiresComment: true },
    { to: "purchasing", actors: ["processor"] },
    { to: "rejected", actors: ["processor"], requiresComment: true },
    { to: "cancelled", actors: ["author", "processor"] },
  ],
  needs_info: [
    { to: "in_review", actors: ["author", "processor"] },
    { to: "purchasing", actors: ["processor"] },
    { to: "rejected", actors: ["processor"], requiresComment: true },
    { to: "cancelled", actors: ["author", "processor"] },
  ],
  purchasing: [
    { to: "ordered", actors: ["processor"] },
    { to: "needs_info", actors: ["processor"], requiresComment: true },
    { to: "rejected", actors: ["processor"], requiresComment: true },
    { to: "cancelled", actors: ["processor"] },
  ],
  ordered: [
    { to: "completed", actors: ["processor"] },
    { to: "needs_info", actors: ["processor"], requiresComment: true },
    { to: "cancelled", actors: ["processor"], requiresComment: true },
  ],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export type TransitionCheck =
  | { allowed: true; requiresComment: boolean }
  | { allowed: false; reason: "unknown_transition" | "not_allowed_for_actor" | "comment_required" };

export function checkTransition(
  from: RequestStatus,
  to: RequestStatus,
  actors: Actor[],
  comment?: string | null,
): TransitionCheck {
  const transition = TRANSITIONS[from]?.find((item) => item.to === to);
  if (!transition) return { allowed: false, reason: "unknown_transition" };
  const allowedForActor = transition.actors.some((actor) => actors.includes(actor));
  if (!allowedForActor) return { allowed: false, reason: "not_allowed_for_actor" };
  if (transition.requiresComment && !comment?.trim()) {
    return { allowed: false, reason: "comment_required" };
  }
  return { allowed: true, requiresComment: Boolean(transition.requiresComment) };
}

export function availableTransitions(from: RequestStatus, actors: Actor[]): Transition[] {
  return (TRANSITIONS[from] ?? []).filter((item) => item.actors.some((actor) => actors.includes(actor)));
}

export const DEFAULT_EDITABLE_STATUSES: RequestStatus[] = ["draft", "submitted", "needs_info"];

export function canEditRequest(options: {
  status: RequestStatus;
  isAuthor: boolean;
  permissions: string[];
  editableStatuses: RequestStatus[];
}): boolean {
  const { status, isAuthor, permissions, editableStatuses } = options;
  if (permissions.includes("requests.edit_any" satisfies Permission)) {
    return !TERMINAL_STATUSES.includes(status);
  }
  if (!isAuthor) return false;
  if (status === "draft") return true;
  return editableStatuses.includes(status);
}

export type TotalsInput = {
  quantity: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
  currency: string | null | undefined;
};

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function lineTotal(item: TotalsInput): number | null {
  const quantity = toNumber(item.quantity);
  const price = toNumber(item.unitPrice);
  if (quantity === null || price === null) return null;
  return Math.round(quantity * price * 10000) / 10000;
}

export function totalsByCurrency(items: TotalsInput[]): { currency: string; total: number; items: number }[] {
  const map = new Map<string, { currency: string; total: number; items: number }>();
  for (const item of items) {
    const total = lineTotal(item);
    if (total === null) continue;
    const currency = (item.currency || "").toUpperCase() || "—";
    const current = map.get(currency) ?? { currency, total: 0, items: 0 };
    current.total = Math.round((current.total + total) * 10000) / 10000;
    current.items += 1;
    map.set(currency, current);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatRequestNumber(year: number, sequence: number): string {
  return `REQ-${year}-${String(sequence).padStart(5, "0")}`;
}
