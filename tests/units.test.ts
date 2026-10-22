import test from "node:test";
import assert from "node:assert/strict";
import { directorySchema, directoryUpdateSchema } from "../src/lib/validation.ts";

test("directorySchema валідує одиниці виміру з короткими назвами", () => {
  const result = directorySchema.parse({
    code: "m",
    name: "м",
    description: "Метри",
    sortOrder: 20,
    isActive: true,
  });

  assert.equal(result.code, "m");
  assert.equal(result.nameUk, "м");
  assert.equal(result.nameRu, "м");
  assert.equal(result.description, "Метри");
  assert.equal(result.sortOrder, 20);
});

test("directorySchema дозволяє одиниці виміру з символами та цифрами у коді", () => {
  const result = directorySchema.parse({
    code: "m2",
    name: "м²",
    description: "Квадратні метри",
    sortOrder: 90,
  });

  assert.equal(result.code, "m2");
  assert.equal(result.nameUk, "м²");
});

test("directoryUpdateSchema дозволяє оновлювати опис та порядок сортування", () => {
  const update = directoryUpdateSchema.parse({
    nameUk: "шт",
    description: "Штуки оновлені",
    sortOrder: 15,
    isActive: false,
  });

  assert.equal(update.nameUk, "шт");
  assert.equal(update.description, "Штуки оновлені");
  assert.equal(update.sortOrder, 15);
  assert.equal(update.isActive, false);
});
