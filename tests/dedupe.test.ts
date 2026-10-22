import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSearchKey,
  findDuplicates,
  normalizePartNumber,
  normalizeText,
  similarity,
} from "../src/lib/dedupe.ts";

test("нормалізація тексту прибирає регістр та пунктуацію", () => {
  assert.equal(normalizeText("  Підшипник, SKF-6204!  "), "підшипник skf 6204");
  assert.equal(normalizeText(null), "");
});

test("артикул порівнюється без роздільників", () => {
  assert.equal(normalizePartNumber("SKF-6204 2RS"), "skf62042rs");
  assert.equal(normalizePartNumber("skf 6204/2rs"), "skf62042rs");
});

test("ключ пошуку об'єднує найменування, артикул та бренд", () => {
  const key = buildSearchKey({ name: "Підшипник", partNumber: "6204-2RS", manufacturer: "SKF" });
  assert.ok(key.includes("підшипник"));
  assert.ok(key.includes("62042rs"));
  assert.ok(key.includes("skf"));
});

test("схожі назви отримують високий коефіцієнт", () => {
  assert.equal(similarity("Підшипник 6204", "Підшипник 6204"), 1);
  assert.ok(similarity("Підшипник 6204", "Підшипник 6204 2RS") > 0.8);
  assert.ok(similarity("Підшипник 6204", "Кабель ВВГ 3х2.5") < 0.3);
});

test("збіг за артикулом вважається дублікатом незалежно від назви", () => {
  const matches = findDuplicates(
    { name: "Зовсім інша назва", partNumber: "skf 6204" },
    [{ id: 10, name: "Підшипник", partNumber: "SKF-6204", manufacturer: "SKF" }],
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 10);
  assert.equal(matches[0].reason, "part_number");
});

test("збіг за кодом БАС вважається дублікатом", () => {
  const matches = findDuplicates(
    { name: "Зовсім інша назва", basCode: "BAS-998877" },
    [{ id: 11, name: "Підшипник", partNumber: null, basCode: "bas 998877", manufacturer: null }],
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 11);
  assert.equal(matches[0].reason, "bas_code");
});

test("несхожі позиції дублікатами не вважаються", () => {
  const matches = findDuplicates({ name: "Кабель ВВГ 3х2.5", partNumber: null }, [
    { id: 1, name: "Підшипник 6204", partNumber: "6204", manufacturer: null },
  ]);
  assert.equal(matches.length, 0);
});
