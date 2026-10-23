"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Field, Select, Textarea } from "./ui";
import { Modal } from "./modal";
import { StatusBadge } from "./status";
import {
  IconCheck,
  IconClock,
  IconMessageSquare,
  IconPrinter,
  IconSend,
  IconUser,
  IconX,
} from "./icons";
import { useLocalizedName, useT } from "./i18n-provider";
import { useConfirm } from "./confirm-provider";

type TransitionOption = { to: string; requiresComment?: boolean };
type Person = { id: number; fullName: string };
type DirectoryOption = { id: number; nameRu: string; nameUk: string };
type ItemOption = { id: number; name: string };

const FORWARD_ORDER = ["submitted", "in_review", "purchasing", "ordered", "completed"];

const FORWARD_META: Record<
  string,
  {
    icon: string;
    bgClass: string;
    hoverClass: string;
  }
> = {
  submitted: {
    icon: "🚀",
    bgClass: "bg-[#12325c]",
    hoverClass: "hover:bg-[#0b1b33]",
  },
  in_review: {
    icon: "📋",
    bgClass: "bg-[#12325c]",
    hoverClass: "hover:bg-[#0b1b33]",
  },
  purchasing: {
    icon: "🛒",
    bgClass: "bg-[#12325c]",
    hoverClass: "hover:bg-[#0b1b33]",
  },
  ordered: {
    icon: "📦",
    bgClass: "bg-indigo-600",
    hoverClass: "hover:bg-indigo-700",
  },
  completed: {
    icon: "✓",
    bgClass: "bg-emerald-600",
    hoverClass: "hover:bg-emerald-700",
  },
};

const PIPELINE_STEPS = ["draft", "submitted", "in_review", "purchasing", "ordered", "completed"];

const STEP_INDEX: Record<string, number> = {
  draft: 0,
  submitted: 1,
  in_review: 2,
  needs_info: 2,
  purchasing: 3,
  ordered: 4,
  completed: 5,
};

export function RequestWorkflowPanel({
  requestId,
  status,
  transitions,
  canAssign,
  assignees,
  assigneeId,
  currentUserId,
  canComment,
  isAuthor,
  canSplit,
  items,
  departments,
  workshops,
  departmentId,
  workshopId,
  editable = false,
}: {
  requestId: number;
  status: string;
  transitions: TransitionOption[];
  canAssign: boolean;
  assignees: Person[];
  assigneeId: number | null;
  currentUserId?: number;
  canComment: boolean;
  isAuthor: boolean;
  canSplit: boolean;
  items: ItemOption[];
  departments: DirectoryOption[];
  workshops: DirectoryOption[];
  departmentId: number;
  workshopId: number;
  editable?: boolean;
}) {
  const t = useT();
  const confirm = useConfirm();
  const localized = useLocalizedName();
  const router = useRouter();

  const [activeModalTransition, setActiveModalTransition] = useState<TransitionOption | null>(null);
  const [modalComment, setModalComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [splitItems, setSplitItems] = useState<number[]>([]);
  const [splitDepartment, setSplitDepartment] = useState(String(departmentId));
  const [splitWorkshop, setSplitWorkshop] = useState(String(workshopId));
  const [splitOpen, setSplitOpen] = useState(false);
  const [currentAssignee, setCurrentAssignee] = useState(assigneeId ? String(assigneeId) : "");

  useEffect(() => {
    setCurrentAssignee(assigneeId ? String(assigneeId) : "");
  }, [assigneeId]);

  async function post(url: string, body: unknown, onDone?: () => void) {
    setBusy(true);
    setFeedback(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (response.ok) {
      setFeedback({ tone: "ok", text: t("common.saved") });
      setTimeout(() => setFeedback(null), 3500);
      onDone?.();
      router.refresh();
      return response;
    }
    const data = (await response.json().catch(() => ({ error: "error" }))) as { error: string };
    setFeedback({
      tone: "error",
      text: data.error === "forbidden" ? t("error.forbidden") : t("error.generic"),
    });
    setTimeout(() => setFeedback(null), 4000);
    return null;
  }

  async function executeTransition(targetStatus: string, commentText?: string) {
    const done = await post(`/api/requests/${requestId}/status`, {
      status: targetStatus,
      comment: commentText || null,
    });
    if (done) {
      setActiveModalTransition(null);
      setModalComment("");
    }
  }

  // Розподіляємо доступні переходи за ролями:
  // 1. Головні кроки "Рух вперед" (Happy Path)
  const forwardTransitions = transitions.filter((tr) => FORWARD_ORDER.includes(tr.to));
  // 2. Запит на уточнення
  const clarificationTransition = transitions.find((tr) => tr.to === "needs_info");
  // 3. Відхилення
  const rejectionTransition = transitions.find((tr) => tr.to === "rejected");
  // 4. Скасування
  const cancellationTransition = transitions.find((tr) => tr.to === "cancelled");
  // 5. Інші переходи
  const otherTransitions = transitions.filter(
    (tr) =>
      !FORWARD_ORDER.includes(tr.to) &&
      tr.to !== "needs_info" &&
      tr.to !== "rejected" &&
      tr.to !== "cancelled",
  );

  const isTerminal = status === "completed" || status === "rejected" || status === "cancelled";
  const currentStepIdx = STEP_INDEX[status] ?? 0;

  return (
    <div className="no-print print:hidden space-y-4">
      {/* Головна картка: Стан процесу та дії */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 sm:px-5 py-3.5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("workflow.currentStatus")}
            </span>
            <StatusBadge status={status} />
          </div>

          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            {t(`workflow.statusDesc.${status}`)}
          </p>

          {/* Міні-пайплайн прогресу (якщо не відхилено/скасовано) */}
          {!isTerminal ? (
            <div className="mt-3.5 pt-3 border-t border-slate-200/60">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {t("workflow.stepOf", { current: currentStepIdx + 1, total: PIPELINE_STEPS.length })}
                </span>
                <span className="text-[11px] font-medium text-slate-700">
                  {t(`status.${PIPELINE_STEPS[currentStepIdx]}`)}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {PIPELINE_STEPS.map((stepKey, idx) => {
                  const isPast = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={stepKey}
                      title={t(`status.${stepKey}`)}
                      className={`h-1.5 rounded-full transition-all ${
                        isPast
                          ? "bg-[#12325c]"
                          : isCurrent
                            ? status === "needs_info"
                              ? "bg-amber-500 ring-2 ring-amber-200"
                              : "bg-[#12325c] ring-2 ring-blue-200"
                            : "bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* СЕКЦІЯ 1: Головна дія (Рух вперед) */}
          {forwardTransitions.length > 0 ? (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("workflow.nextAction")}
              </span>
              <div className="space-y-2">
                {forwardTransitions.map((tr) => {
                  const meta = FORWARD_META[tr.to];
                  const title = t(`workflow.action.${tr.to}.title`);
                  const subtitle = t(`workflow.action.${tr.to}.subtitle`);
                  const icon = meta?.icon || "➔";
                  const bgClass = meta?.bgClass || "bg-[#12325c]";
                  const hoverClass = meta?.hoverClass || "hover:bg-[#0b1b33]";

                  return (
                    <button
                      key={tr.to}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (tr.requiresComment) {
                          setActiveModalTransition(tr);
                        } else {
                          void executeTransition(tr.to);
                        }
                      }}
                      className={`group relative w-full rounded-xl px-4 py-3.5 text-white shadow-sm transition-all duration-150 flex items-center justify-between text-left cursor-pointer active:scale-[0.99] disabled:opacity-50 ${bgClass} ${hoverClass}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-base font-bold">
                          {icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-snug tracking-tight truncate">
                            {title}
                          </p>
                          <p className="text-[11px] text-white/80 leading-tight truncate">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-transform text-lg font-bold ml-2 shrink-0">
                        →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* СЕКЦІЯ 2: Альтернативні дії (Запит на уточнення) */}
          {clarificationTransition ? (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t("workflow.clarificationTitle")}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setActiveModalTransition(clarificationTransition)}
                className="w-full rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/80 px-4 py-2.5 text-left text-amber-950 transition flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base leading-none">💬</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight">{t("workflow.requestClarification")}</p>
                    <p className="text-[11px] text-amber-800 leading-tight truncate">
                      {t("workflow.requestClarificationDesc")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-700 group-hover:underline shrink-0">
                  {t("workflow.requestBadge")}
                </span>
              </button>
            </div>
          ) : null}

          {/* СЕКЦІЯ 3: Інші нетипові переходи (якщо є) */}
          {otherTransitions.length > 0 ? (
            <div className="space-y-2">
              {otherTransitions.map((tr) => (
                <Button
                  key={tr.to}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  className="w-full justify-start"
                  onClick={() => {
                    if (tr.requiresComment) {
                      setActiveModalTransition(tr);
                    } else {
                      void executeTransition(tr.to);
                    }
                  }}
                >
                  <IconClock className="h-4 w-4" />
                  <span>{t("workflow.moveToStatus", { status: t(`status.${tr.to}`) })}</span>
                </Button>
              ))}
            </div>
          ) : null}

          {/* СЕКЦІЯ 4: Винятки, відхилення та скасування */}
          {rejectionTransition || cancellationTransition ? (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {rejectionTransition ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setActiveModalTransition(rejectionTransition)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 active:bg-rose-100 px-3 py-2.5 sm:py-2 text-xs font-semibold text-rose-700 transition cursor-pointer min-h-[40px]"
                  >
                    <span>✕</span>
                    <span>{t("workflow.rejectRequest")}</span>
                  </button>
                ) : null}

                {cancellationTransition ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setActiveModalTransition(cancellationTransition)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 px-3 py-2.5 sm:py-2 text-xs font-semibold text-slate-600 transition cursor-pointer min-h-[40px]"
                  >
                    <span>{t("workflow.cancelRequest")}</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Якщо переходів взагалі немає для ролі */}
          {transitions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-1">
              {isTerminal
                ? t("workflow.closedLocked")
                : t("workflow.noActionsForRole")}
            </p>
          ) : null}

          {/* Відповідальний закупник (призначення або перегляд) */}
          {canAssign || currentAssignee || isTerminal ? (
            <div className="pt-3 border-t border-slate-100">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t("workflow.assignBuyer")}
                  </span>
                  {!isTerminal &&
                  canAssign &&
                  currentUserId &&
                  String(currentUserId) !== currentAssignee &&
                  assignees.some((a) => a.id === currentUserId) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setCurrentAssignee(String(currentUserId));
                        void post(`/api/requests/${requestId}/assign`, {
                          assigneeId: currentUserId,
                        });
                      }}
                      className="text-[11px] font-semibold text-[#12325c] hover:underline"
                    >
                      {t("workflow.takeOwnership")}
                    </button>
                  ) : null}
                </div>

                {!isTerminal && canAssign ? (
                  <Select
                    value={currentAssignee}
                    disabled={busy}
                    onChange={(event) => {
                      const nextVal = event.target.value;
                      setCurrentAssignee(nextVal);
                      void post(`/api/requests/${requestId}/assign`, {
                        assigneeId: nextVal ? Number(nextVal) : null,
                      });
                    }}
                    className="bg-white text-xs font-medium"
                  >
                    <option value="">{t("request.noAssignee")}</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        👤
                      </span>
                      <span className="font-semibold text-slate-800 truncate">
                        {assignees.find((person) => String(person.id) === currentAssignee)?.fullName ||
                          (currentAssignee ? t("workflow.buyerLabel", { id: currentAssignee }) : t("request.noAssignee"))}
                      </span>
                    </div>
                    {isTerminal ? (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">{t("workflow.closedBadge")}</span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Редагування заявки та позицій */}
          {editable ? (
            <div className="pt-3 border-t border-slate-100">
              <Link
                href={`/requests/${requestId}/edit`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-50/90 hover:bg-blue-100 px-3.5 py-2.5 text-xs font-bold text-[#12325c] ring-1 ring-blue-200 transition shadow-2xs"
              >
                <span>✏️</span>
                <span>{t("workflow.editRequest")}</span>
              </Link>
              <p className="mt-1.5 text-center text-[11px] text-slate-500">
                {status === "needs_info"
                  ? t("workflow.editHintNeedsInfo")
                  : status === "draft"
                    ? t("workflow.editHintDraft")
                    : t("workflow.editHintActive")}
              </p>
            </div>
          ) : null}

          {/* Розділення заявки */}
          {canSplit && items.length > 1 ? (
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                className="text-xs font-semibold text-[#12325c] hover:underline flex items-center gap-1.5"
                onClick={() => setSplitOpen((value) => !value)}
              >
                <span>⚡</span>
                <span>{splitOpen ? t("workflow.hideSplit") : t("workflow.splitIntoNew")}</span>
              </button>

              {splitOpen ? (
                <div className="animate-fade-in mt-2.5 space-y-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                  <p className="text-[11px] text-slate-500 leading-normal">{t("request.splitHint")}</p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {items.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-200/80 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={splitItems.includes(item.id)}
                          onChange={(event) =>
                            setSplitItems((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((candidate) => candidate !== item.id),
                            )
                          }
                        />
                        <span className="truncate font-medium">{item.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <Field label={t("request.department")}>
                      <Select
                        value={splitDepartment}
                        onChange={(event) => setSplitDepartment(event.target.value)}
                      >
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {localized(department)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("request.workshop")}>
                      <Select
                        value={splitWorkshop}
                        onChange={(event) => setSplitWorkshop(event.target.value)}
                      >
                        {workshops.map((workshop) => (
                          <option key={workshop.id} value={workshop.id}>
                            {localized(workshop)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={busy || splitItems.length === 0 || splitItems.length === items.length}
                    onClick={async () => {
                      const response = await post(`/api/requests/${requestId}/split`, {
                        itemIds: splitItems,
                        departmentId: Number(splitDepartment),
                        workshopId: Number(splitWorkshop),
                      });
                      if (response) {
                        const data = (await response.json()) as { id: number };
                        setSplitItems([]);
                        setSplitOpen(false);
                        router.push(`/requests/${data.id}`);
                      }
                    }}
                  >
                    {t("workflow.splitButton", { count: splitItems.length })}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {feedback ? (
            <p
              className={`rounded-xl px-3 py-2 text-xs font-medium ring-1 ${
                feedback.tone === "ok"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                  : "bg-rose-50 text-rose-800 ring-rose-300"
              }`}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>
      </Card>

      {/* Коментарі / Питання-відповіді до заявки */}
      {canComment ? (
        <Card>
          <CardHeader
            title={
              status === "needs_info" && isAuthor
                ? t("workflow.clarificationAnswerTitle")
                : t("workflow.commentsTitle")
            }
            description={t("workflow.commentsDesc")}
            className="px-4 sm:px-5 py-3 sm:py-3.5"
          />
          <div className="space-y-3 p-4 sm:p-5">
            <Textarea
              rows={3}
              value={message}
              placeholder={
                status === "needs_info" && isAuthor
                  ? t("workflow.answerPlaceholder")
                  : t("workflow.commentPlaceholder")
              }
              onChange={(event) => setMessage(event.target.value)}
              className="text-xs sm:text-sm"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={busy || !message.trim()}
                className="w-full sm:w-auto font-semibold"
                onClick={async () => {
                  const done = await post(`/api/requests/${requestId}/comments`, {
                    message,
                    type: status === "needs_info" && isAuthor ? "answer" : "comment",
                  });
                  if (done) setMessage("");
                }}
              >
                <IconSend className="h-3.5 w-3.5" />
                <span>{t("common.add")}</span>
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* МОДАЛЬНЕ ВІКНО ДЛЯ ДІЙ, ЩО ПОТРЕБУЮТЬ ПОЯСНЕННЯ (Уточнення / Відхилення / Скасування) */}
      <Modal
        isOpen={!!activeModalTransition}
        onClose={() => {
          setActiveModalTransition(null);
          setModalComment("");
        }}
        title={
          activeModalTransition?.to === "needs_info"
            ? t("workflow.modalNeedsInfoTitle")
            : activeModalTransition?.to === "rejected"
              ? t("workflow.modalRejectedTitle")
              : activeModalTransition?.to === "cancelled"
                ? t("workflow.modalCancelledTitle")
                : t("workflow.modalTransitionTitle", {
                    status: t(`status.${activeModalTransition?.to || ""}`),
                  })
        }
        description={
          activeModalTransition?.to === "needs_info"
            ? t("workflow.modalNeedsInfoDesc")
            : activeModalTransition?.to === "rejected"
              ? t("workflow.modalRejectedDesc")
              : activeModalTransition?.to === "cancelled"
                ? t("workflow.modalCancelledDesc")
                : t("workflow.modalTransitionDesc")
        }
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setActiveModalTransition(null);
                setModalComment("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant={
                activeModalTransition?.to === "rejected" || activeModalTransition?.to === "cancelled"
                  ? "danger"
                  : "primary"
              }
              size="sm"
              disabled={busy || (activeModalTransition?.requiresComment && !modalComment.trim())}
              onClick={() => {
                if (activeModalTransition) {
                  void executeTransition(activeModalTransition.to, modalComment);
                }
              }}
            >
              {activeModalTransition?.to === "needs_info"
                ? t("workflow.modalSendInquiry")
                : activeModalTransition?.to === "rejected"
                  ? t("workflow.modalConfirmRejection")
                  : activeModalTransition?.to === "cancelled"
                    ? t("workflow.modalConfirmCancellation")
                    : t("common.confirm")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            {activeModalTransition?.to === "needs_info"
              ? t("workflow.modalNeedsInfoLabel")
              : activeModalTransition?.to === "rejected"
                ? t("workflow.modalRejectedLabel")
                : t("workflow.modalCommentLabel")}
          </label>
          <Textarea
            rows={4}
            autoFocus
            value={modalComment}
            placeholder={
              activeModalTransition?.to === "needs_info"
                ? t("workflow.modalNeedsInfoPlaceholder")
                : activeModalTransition?.to === "rejected"
                  ? t("workflow.modalRejectedPlaceholder")
                  : t("workflow.modalCommentPlaceholder")
            }
            onChange={(e) => setModalComment(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
