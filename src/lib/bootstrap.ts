import "server-only";
import { sql } from "drizzle-orm";
import { client, db } from "@/db";
import { initSqliteTables } from "@/db/init";
import { departments, roles, unitsOfMeasurement, users } from "@/db/schema";
import { ROLE_PRESETS } from "./permissions";

export const INITIAL_UNITS = [
  { code: "pcs", nameRu: "шт", nameUk: "шт", description: "Штуки", sortOrder: 10 },
  { code: "m", nameRu: "м", nameUk: "м", description: "Метри погонні", sortOrder: 20 },
  { code: "kg", nameRu: "кг", nameUk: "кг", description: "Кілограми", sortOrder: 30 },
  { code: "l", nameRu: "л", nameUk: "л", description: "Літри", sortOrder: 40 },
  { code: "set", nameRu: "компл", nameUk: "компл", description: "Комплекти", sortOrder: 50 },
  { code: "pack", nameRu: "пач", nameUk: "пач", description: "Пачки", sortOrder: 60 },
  { code: "t", nameRu: "т", nameUk: "т", description: "Тонни", sortOrder: 70 },
  { code: "roll", nameRu: "рул", nameUk: "рул", description: "Рулони", sortOrder: 80 },
  { code: "m2", nameRu: "м²", nameUk: "м²", description: "Квадратні метри", sortOrder: 90 },
  { code: "m3", nameRu: "м³", nameUk: "м³", description: "Кубічні метри", sortOrder: 100 },
  { code: "box", nameRu: "ящ", nameUk: "ящ", description: "Ящики / коробки", sortOrder: 110 },
];

/**
 * Створює системні ролі, напрями закупівлі та базовий довідник одиниць виміру.
 */
export async function ensureCoreData(): Promise<void> {
  await initSqliteTables(client);

  for (const preset of ROLE_PRESETS) {
    await db
      .insert(roles)
      .values({
        code: preset.code,
        nameRu: preset.nameRu,
        nameUk: preset.nameUk,
        permissions: preset.permissions,
        isSystem: preset.isSystem,
      })
      .onConflictDoNothing({ target: roles.code });
  }

  const directions = [
    { code: "import", nameRu: "Імпорт", nameUk: "Імпорт", sortOrder: 10 },
    { code: "ukraine", nameRu: "Україна", nameUk: "Україна", sortOrder: 20 },
  ];
  for (const direction of directions) {
    await db.insert(departments).values(direction).onConflictDoNothing({ target: departments.code });
  }

  for (const unit of INITIAL_UNITS) {
    await db.insert(unitsOfMeasurement).values(unit).onConflictDoNothing({ target: unitsOfMeasurement.code });
  }
}

export async function countUsers(): Promise<number> {
  await initSqliteTables(client);
  const [row] = await db.select({ value: sql<number>`count(*)` }).from(users);
  return Number(row?.value ?? 0);
}

export async function isSystemInitialized(): Promise<boolean> {
  try {
    await initSqliteTables(client);
    return (await countUsers()) > 0;
  } catch {
    return false;
  }
}
