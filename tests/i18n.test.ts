import test from "node:test";
import assert from "node:assert/strict";
import { translate, en, uk, localizedName } from "../src/lib/i18n.ts";

test("translate interpolates parameters correctly", () => {
  const resultEn = translate(en, "admin.maintenance.backupSuccess", uk, {
    filename: "procurement-2026.db",
    size: "1.2 MB",
  });
  assert.equal(
    resultEn,
    'Backup snapshot "procurement-2026.db" (1.2 MB) saved on server.',
  );

  const resultUk = translate(uk, "admin.maintenance.backupSuccess", en, {
    filename: "procurement-2026.db",
    size: "1.2 МБ",
  });
  assert.equal(
    resultUk,
    "Резервну копію «procurement-2026.db» (1.2 МБ) успішно збережено на сервері.",
  );
});

test("translate handles missing parameters gracefully", () => {
  const result = translate(en, "common.save");
  assert.equal(result, "Save");
});

test("localizedName dynamically maps directory codes for English and Ukrainian", () => {
  const dept = { code: "import", nameUk: "Імпорт", nameRu: "Импорт" };
  assert.equal(localizedName("en", dept), "Import Procurement");
  assert.equal(localizedName("uk", dept), "Імпорт");

  const workshop = { code: "assembly", nameUk: "Цех збирання №1", nameRu: "Сборочный цех №1" };
  assert.equal(localizedName("en", workshop), "Assembly Shop #1");
  assert.equal(localizedName("uk", workshop), "Цех збирання №1");
});
