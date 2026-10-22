import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSearchKey, findDuplicates, normalizePartNumber } from "../src/lib/dedupe.ts";
import { nomenclatureCreateSchema, nomenclatureUpdateSchema } from "../src/lib/validation.ts";

test("валідація дозволяє створювати номенклатуру з кодом БАС", () => {
  const parsed = nomenclatureCreateSchema.parse({
    name: "Фільтр гідравлічний",
    partNumber: "HF6510",
    basCode: "BAS-990011",
    manufacturer: "Donaldson",
    unit: "шт",
  });
  assert.equal(parsed.name, "Фільтр гідравлічний");
  assert.equal(parsed.basCode, "BAS-990011");
});

test("валідація оновлення номенклатури дозволяє редагувати код БАС", () => {
  const parsed = nomenclatureUpdateSchema.parse({
    basCode: "00-00123456",
  });
  assert.equal(parsed.basCode, "00-00123456");
});

test("порожній код БАС перетворюється на null", () => {
  const parsed = nomenclatureCreateSchema.parse({
    name: "Гайка М8",
    basCode: "   ",
  });
  assert.equal(parsed.basCode, null);
});

test("ключ пошуку містить нормалізований код БАС", () => {
  const key = buildSearchKey({
    name: "Муфта еластична",
    partNumber: "ME-100",
    basCode: "BAS-44-55-66",
    manufacturer: "KTR",
  });
  assert.ok(key.includes("bas445566"));
});

test("виявлення дублікатів знаходить номенклатуру за кодом БАС", () => {
  const candidates = [
    {
      id: 42,
      name: "Клапан редукційний",
      partNumber: "PRV-10",
      basCode: "00-009876",
      manufacturer: "Rexroth",
    },
  ];

  const matches = findDuplicates(
    { name: "Інша назва клапана", basCode: "00009876" },
    candidates,
  );

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 42);
  assert.equal(matches[0].reason, "bas_code");
});
