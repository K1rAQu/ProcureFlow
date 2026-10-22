import { createClient } from "@libsql/client";
import { resolve } from "node:path";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const dbPath = resolve(process.cwd(), "data", "procurement.db");
const client = createClient({ url: `file:${dbPath}` });

const email = "test@localhost";
const password = "test";
const passwordHash = await hashPassword(password);

// Отримуємо роль admin
const rolesRes = await client.execute("SELECT id FROM roles WHERE code = 'admin' LIMIT 1;");
let adminRoleId = rolesRes.rows[0]?.id;

if (!adminRoleId) {
  // Якщо ролі ще немає, створюємо її
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO roles (code, name_ru, name_uk, permissions, is_system, created_at, updated_at) 
          VALUES ('admin', 'Адміністратор', 'Адміністратор', '["requests.create","requests.view_own","requests.view_all","requests.view_workshop","requests.process","requests.assign","requests.edit_any","nomenclature.view","nomenclature.create","nomenclature.edit","nomenclature.archive","nomenclature.merge","nomenclature.approve","admin.users","admin.roles","admin.directories","admin.settings","audit.view"]', 1, ?, ?);`,
    args: [now, now],
  });
  const newRole = await client.execute("SELECT id FROM roles WHERE code = 'admin' LIMIT 1;");
  adminRoleId = newRole.rows[0]?.id;
}

const existing = await client.execute({
  sql: "SELECT id FROM users WHERE email = ? LIMIT 1;",
  args: [email],
});

const now = Date.now();

if (existing.rows.length > 0) {
  await client.execute({
    sql: "UPDATE users SET password_hash = ?, role_id = ?, is_active = 1, updated_at = ? WHERE email = ?;",
    args: [passwordHash, adminRoleId, now, email],
  });
  console.log(`Користувача ${email} оновлено з новим паролем і роллю адміністратора (ID: ${existing.rows[0].id}).`);
} else {
  const inserted = await client.execute({
    sql: `INSERT INTO users (email, full_name, password_hash, role_id, locale, is_active, created_at, updated_at)
          VALUES (?, 'Тестовий Адміністратор', ?, ?, 'uk', 1, ?, ?) RETURNING id;`,
    args: [email, passwordHash, adminRoleId, now, now],
  });
  console.log(`Створено нового користувача ${email} з паролем "${password}" (ID: ${inserted.rows[0]?.id}).`);
}

client.close();
