import type { Client } from "@libsql/client";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_uk TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workshops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_uk TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_uk TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS units_of_measurement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_uk TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    workshop_id INTEGER REFERENCES workshops(id),
    department_id INTEGER REFERENCES departments(id),
    locale TEXT NOT NULL DEFAULT 'uk',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT,
    ip TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);`,
  `CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS nomenclature (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    part_number TEXT,
    bas_code TEXT,
    manufacturer TEXT,
    url TEXT,
    description TEXT,
    specs TEXT,
    unit TEXT NOT NULL DEFAULT 'шт',
    status TEXT NOT NULL DEFAULT 'active',
    last_price TEXT,
    last_currency TEXT,
    last_price_at INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    merged_into_id INTEGER,
    search_key TEXT NOT NULL DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS nomenclature_name_idx ON nomenclature(name);`,
  `CREATE INDEX IF NOT EXISTS nomenclature_part_idx ON nomenclature(part_number);`,
  `CREATE INDEX IF NOT EXISTS nomenclature_bas_idx ON nomenclature(bas_code);`,
  `CREATE INDEX IF NOT EXISTS nomenclature_status_idx ON nomenclature(status);`,
  `CREATE TABLE IF NOT EXISTS nomenclature_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomenclature_id INTEGER NOT NULL REFERENCES nomenclature(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id),
    sort_order INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS nomenclature_images_item_idx ON nomenclature_images(nomenclature_id);`,
  `CREATE TABLE IF NOT EXISTS nomenclature_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomenclature_id INTEGER NOT NULL REFERENCES nomenclature(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    changes TEXT,
    note TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS nomenclature_history_item_idx ON nomenclature_history(nomenclature_id);`,
  `CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    workshop_id INTEGER NOT NULL REFERENCES workshops(id),
    assignee_id INTEGER REFERENCES users(id),
    parent_request_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'normal',
    comment TEXT,
    desired_date TEXT,
    submitted_at INTEGER,
    closed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS requests_author_idx ON requests(author_id);`,
  `CREATE INDEX IF NOT EXISTS requests_status_idx ON requests(status);`,
  `CREATE INDEX IF NOT EXISTS requests_department_idx ON requests(department_id);`,
  `CREATE INDEX IF NOT EXISTS requests_workshop_idx ON requests(workshop_id);`,
  `CREATE TABLE IF NOT EXISTS request_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    nomenclature_id INTEGER REFERENCES nomenclature(id),
    position INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    part_number TEXT,
    quantity TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'шт',
    unit_price TEXT,
    currency TEXT,
    url TEXT,
    comment TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS request_items_request_idx ON request_items(request_id);`,
  `CREATE TABLE IF NOT EXISTS request_item_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_item_id INTEGER NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id),
    sort_order INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS request_item_images_item_idx ON request_item_images(request_item_id);`,
  `CREATE TABLE IF NOT EXISTS request_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    message TEXT,
    payload TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS request_events_request_idx ON request_events(request_id);`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT,
    payload TEXT,
    ip TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);`,
  `CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at);`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    result TEXT,
    created_at INTEGER NOT NULL
  );`
];

let initPromise: Promise<void> | null = null;

export async function initSqliteTables(client: Client): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await client.execute("PRAGMA journal_mode = WAL;");
      await client.execute("PRAGMA busy_timeout = 10000;");
    } catch {
      // WAL can fail on in-memory or readonly
    }

    for (const stmt of SCHEMA_STATEMENTS) {
      try {
        await client.execute(stmt);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        if (error.code !== "SQLITE_BUSY" && !error.message?.includes("already exists")) {
          throw err;
        }
      }
    }
  })();

  return initPromise;
}
