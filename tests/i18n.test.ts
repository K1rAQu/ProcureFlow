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

test("settingsSchema validates defaultLocale and requireUserApproval correctly", async () => {
  const { settingsSchema } = await import("../src/lib/validation.ts");
  const parsedEn = settingsSchema.parse({ defaultLocale: "en", requireUserApproval: true });
  assert.equal(parsedEn.defaultLocale, "en");
  assert.equal(parsedEn.requireUserApproval, true);

  const parsedUk = settingsSchema.parse({ defaultLocale: "uk", requireUserApproval: false });
  assert.equal(parsedUk.defaultLocale, "uk");
  assert.equal(parsedUk.requireUserApproval, false);

  assert.throws(() => {
    settingsSchema.parse({ defaultLocale: "de" });
  });
});

test("pending approval and activation keys exist in both en and uk", () => {
  const requiredKeys = [
    "auth.pendingApprovalTitle",
    "auth.pendingApprovalSubtitle",
    "auth.pendingNoticeTitle",
    "auth.pendingApprovalNotice",
    "auth.checkStatus",
    "admin.statusPending",
    "admin.activate",
    "admin.activateConfirmTitle",
    "admin.activateConfirmMsg",
    "admin.settingRequireApproval",
    "admin.settingRequireApprovalHint",
  ];

  for (const key of requiredKeys) {
    assert.ok(en[key], `Missing en key: ${key}`);
    assert.ok(uk[key], `Missing uk key: ${key}`);
  }
});

