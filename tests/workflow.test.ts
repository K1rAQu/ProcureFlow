import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableTransitions,
  canEditRequest,
  checkTransition,
  formatRequestNumber,
  lineTotal,
  totalsByCurrency,
  TERMINAL_STATUSES,
} from "../src/lib/workflow.ts";

test("автор може надіслати чернетку, але не може прийняти її в обробку", () => {
  assert.equal(checkTransition("draft", "submitted", ["author"]).allowed, true);
  const forbidden = checkTransition("submitted", "in_review", ["author"]);
  assert.equal(forbidden.allowed, false);
  assert.equal(forbidden.allowed === false && forbidden.reason, "not_allowed_for_actor");
});

test("обробник приймає заявку та веде її за циклом до завершення", () => {
  assert.equal(checkTransition("submitted", "in_review", ["processor"]).allowed, true);
  assert.equal(checkTransition("in_review", "purchasing", ["processor"]).allowed, true);
  assert.equal(checkTransition("purchasing", "ordered", ["processor"]).allowed, true);
  assert.equal(checkTransition("ordered", "completed", ["processor"]).allowed, true);
});

test("запит уточнення та відхилення вимагають коментаря", () => {
  const withoutComment = checkTransition("in_review", "needs_info", ["processor"]);
  assert.equal(withoutComment.allowed, false);
  assert.equal(withoutComment.allowed === false && withoutComment.reason, "comment_required");
  assert.equal(checkTransition("in_review", "needs_info", ["processor"], "уточніть артикул").allowed, true);
  assert.equal(checkTransition("submitted", "rejected", ["processor"], "немає бюджету").allowed, true);
});

test("із завершених статусів переходів немає", () => {
  for (const status of ["completed", "rejected", "cancelled"] as const) {
    assert.equal(availableTransitions(status, ["author", "processor"]).length, 0);
    assert.ok(TERMINAL_STATUSES.includes(status));
  }
});

test("неіснуючий перехід заборонено", () => {
  const result = checkTransition("draft", "completed", ["author", "processor"]);
  assert.equal(result.allowed, false);
  assert.equal(result.allowed === false && result.reason, "unknown_transition");
});

test("правила редагування заявки враховують налаштування та роль", () => {
  const editableStatuses = ["draft", "submitted", "needs_info"] as const;
  assert.equal(
    canEditRequest({ status: "draft", isAuthor: true, permissions: [], editableStatuses: [...editableStatuses] }),
    true,
  );
  assert.equal(
    canEditRequest({ status: "purchasing", isAuthor: true, permissions: [], editableStatuses: [...editableStatuses] }),
    false,
  );
  assert.equal(
    canEditRequest({ status: "submitted", isAuthor: false, permissions: [], editableStatuses: [...editableStatuses] }),
    false,
  );
  assert.equal(
    canEditRequest({
      status: "purchasing",
      isAuthor: false,
      permissions: ["requests.edit_any"],
      editableStatuses: [...editableStatuses],
    }),
    true,
  );
  assert.equal(
    canEditRequest({
      status: "completed",
      isAuthor: false,
      permissions: ["requests.edit_any"],
      editableStatuses: [...editableStatuses],
    }),
    false,
  );
});

test("вартість позиції розраховується лише за наявності ціни та кількості", () => {
  assert.equal(lineTotal({ quantity: "2", unitPrice: "10.5", currency: "UAH" }), 21);
  assert.equal(lineTotal({ quantity: "2", unitPrice: null, currency: "UAH" }), null);
  assert.equal(lineTotal({ quantity: "2,5", unitPrice: "2", currency: "UAH" }), 5);
});

test("підсумки не сумують різні валюти", () => {
  const totals = totalsByCurrency([
    { quantity: 2, unitPrice: 10, currency: "UAH" },
    { quantity: 1, unitPrice: 5, currency: "UAH" },
    { quantity: 3, unitPrice: 100, currency: "EUR" },
    { quantity: 3, unitPrice: null, currency: "USD" },
  ]);
  assert.deepEqual(totals, [
    { currency: "EUR", total: 300, items: 1 },
    { currency: "UAH", total: 25, items: 2 },
  ]);
});

test("номер заявки формується за роком та порядковим номером", () => {
  assert.equal(formatRequestNumber(2026, 7), "REQ-2026-00007");
});
