import { createClient } from "@libsql/client";
import { resolve } from "node:path";

const dbUrl = process.env.DATABASE_URL || `file:${resolve(process.cwd(), "data", "procurement.db")}`;
const client = createClient({
  url: dbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

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

async function seed() {
  console.log("Seeding realistic demo data into:", dbPath);

  const now = Date.now();
  const oneHourAgo = now - 3600 * 1000;
  const twoHoursAgo = now - 2 * 3600 * 1000;
  const oneDayAgo = now - 86400 * 1000;
  const twoDaysAgo = now - 2 * 86400 * 1000;
  const fiveDaysAgo = now - 5 * 86400 * 1000;
  const tenDaysAgo = now - 10 * 86400 * 1000;

  try {
    await client.execute("PRAGMA journal_mode = WAL;");
    await client.execute("PRAGMA busy_timeout = 10000;");
  } catch {}

  // 1. Ensure all schema tables exist
  for (const stmt of SCHEMA_STATEMENTS) {
    try {
      await client.execute(stmt);
    } catch (err) {
      if (!String(err).includes("already exists")) {
        console.warn("Schema warning:", err);
      }
    }
  }

  await client.execute("PRAGMA foreign_keys = OFF;");

  // 2. Clear existing transactional tables for a fresh state
  console.log("Cleaning old records for clean demo state...");
  await client.execute("DELETE FROM request_item_images;");
  await client.execute("DELETE FROM request_items;");
  await client.execute("DELETE FROM request_events;");
  await client.execute("DELETE FROM requests;");
  await client.execute("DELETE FROM nomenclature_images;");
  await client.execute("DELETE FROM nomenclature_history;");
  await client.execute("DELETE FROM nomenclature;");
  await client.execute("DELETE FROM files;");
  await client.execute("DELETE FROM notifications;");
  await client.execute("DELETE FROM audit_log;");
  await client.execute("DELETE FROM sessions;");
  await client.execute("DELETE FROM idempotency_keys;");
  await client.execute("DELETE FROM counters;");
  try {
    await client.execute("DELETE FROM sqlite_sequence;");
  } catch {}

  // 3. Ensure Roles
  const rolesData = [
    {
      code: "admin",
      nameRu: "Администратор",
      nameUk: "Адміністратор",
      permissions: JSON.stringify([
        "requests.create", "requests.view_own", "requests.view_all", "requests.view_workshop",
        "requests.process", "requests.assign", "requests.edit_any",
        "nomenclature.view", "nomenclature.create", "nomenclature.edit", "nomenclature.archive", "nomenclature.merge", "nomenclature.approve",
        "admin.users", "admin.roles", "admin.directories", "admin.settings", "audit.view"
      ]),
      isSystem: 1
    },
    {
      code: "buyer",
      nameRu: "Закупщик",
      nameUk: "Закупник",
      permissions: JSON.stringify([
        "requests.create", "requests.view_own", "requests.view_all", "requests.view_workshop",
        "requests.process", "requests.assign", "requests.edit_any",
        "nomenclature.view", "nomenclature.create", "nomenclature.edit", "nomenclature.archive", "nomenclature.merge", "nomenclature.approve"
      ]),
      isSystem: 1
    },
    {
      code: "workshop_master",
      nameRu: "Начальник цеха / мастер",
      nameUk: "Начальник цеху / майстер",
      permissions: JSON.stringify([
        "requests.create", "requests.view_own", "requests.view_workshop",
        "nomenclature.view", "nomenclature.create"
      ]),
      isSystem: 1
    },
    {
      code: "requester",
      nameRu: "Инициатор",
      nameUk: "Ініціатор",
      permissions: JSON.stringify([
        "requests.create", "requests.view_own",
        "nomenclature.view"
      ]),
      isSystem: 1
    }
  ];

  for (const r of rolesData) {
    const existing = await client.execute({ sql: "SELECT id FROM roles WHERE code = ?", args: [r.code] });
    if (existing.rows.length === 0) {
      await client.execute({
        sql: "INSERT INTO roles (code, name_ru, name_uk, permissions, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [r.code, r.nameRu, r.nameUk, r.permissions, r.isSystem, now, now]
      });
    }
  }

  const roleMap = {};
  const allRoles = await client.execute("SELECT id, code FROM roles");
  for (const r of allRoles.rows) {
    roleMap[r.code] = r.id;
  }

  // 4. Ensure Departments
  const departmentsData = [
    { code: "import", nameRu: "Импорт", nameUk: "Імпорт", desc: "Імпортні закупівлі обладнання та комплектуючих", sortOrder: 10 },
    { code: "ukraine", nameRu: "Украина", nameUk: "Україна", desc: "Внутрішній ринок України", sortOrder: 20 },
    { code: "it", nameRu: "IT и связи", nameUk: "IT та зв'язок", desc: "Серверне, мережеве та офісне обладнання", sortOrder: 30 },
    { code: "mro", nameRu: "ТОиР и снабжение", nameUk: "МТР та розхідники", desc: "Матеріально-технічне забезпечення ремонтів", sortOrder: 40 }
  ];

  for (const d of departmentsData) {
    const ex = await client.execute({ sql: "SELECT id FROM departments WHERE code = ?", args: [d.code] });
    if (ex.rows.length === 0) {
      await client.execute({
        sql: "INSERT INTO departments (code, name_ru, name_uk, description, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
        args: [d.code, d.nameRu, d.nameUk, d.desc, d.sortOrder, now, now]
      });
    }
  }

  const depMap = {};
  const allDeps = await client.execute("SELECT id, code FROM departments");
  for (const d of allDeps.rows) {
    depMap[d.code] = d.id;
  }

  // 5. Ensure Workshops
  const workshopsData = [
    { code: "assembly", nameRu: "Сборочный цех №1", nameUk: "Цех збирання №1", desc: "Головна лінія кінцевого складання", sortOrder: 10 },
    { code: "cnc", nameRu: "Цех станков с ЧПУ", nameUk: "Цех верстатів з ЧПК", desc: "Механічна обробка металів та композитів", sortOrder: 20 },
    { code: "electronics", nameRu: "Цех электроники и автоматики", nameUk: "Цех автоматики та електроніки", desc: "Шафи керування, сенсори та пайка", sortOrder: 30 },
    { code: "maintenance", nameRu: "Ремонтно-механический отдел", nameUk: "Ремонтно-механічний відділ", desc: "Планово-попереджувальний ремонт устаткування", sortOrder: 40 },
    { code: "warehouse", nameRu: "Центральный склад", nameUk: "Центральний склад", desc: "Приймання та зберігання ТМЦ", sortOrder: 50 }
  ];

  for (const w of workshopsData) {
    const ex = await client.execute({ sql: "SELECT id FROM workshops WHERE code = ?", args: [w.code] });
    if (ex.rows.length === 0) {
      await client.execute({
        sql: "INSERT INTO workshops (code, name_ru, name_uk, description, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
        args: [w.code, w.nameRu, w.nameUk, w.desc, w.sortOrder, now, now]
      });
    }
  }

  const wsMap = {};
  const allWs = await client.execute("SELECT id, code FROM workshops");
  for (const w of allWs.rows) {
    wsMap[w.code] = w.id;
  }

  // 6. Ensure Units of Measurement
  const unitsData = [
    { code: "pcs", nameRu: "шт", nameUk: "шт", desc: "Штуки", sortOrder: 10 },
    { code: "m", nameRu: "м", nameUk: "м", desc: "Метри", sortOrder: 20 },
    { code: "kg", nameRu: "кг", nameUk: "кг", desc: "Кілограми", sortOrder: 30 },
    { code: "l", nameRu: "л", nameUk: "л", desc: "Літри", sortOrder: 40 },
    { code: "set", nameRu: "компл", nameUk: "компл", desc: "Комплекти", sortOrder: 50 },
    { code: "pack", nameRu: "пач", nameUk: "пач", desc: "Пачки", sortOrder: 60 },
    { code: "box", nameRu: "ящ", nameUk: "ящ", desc: "Ящики", sortOrder: 70 },
    { code: "roll", nameRu: "рул", nameUk: "рул", desc: "Рулони", sortOrder: 80 }
  ];

  for (const u of unitsData) {
    const ex = await client.execute({ sql: "SELECT id FROM units_of_measurement WHERE code = ?", args: [u.code] });
    if (ex.rows.length === 0) {
      await client.execute({
        sql: "INSERT INTO units_of_measurement (code, name_ru, name_uk, description, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
        args: [u.code, u.nameRu, u.nameUk, u.desc, u.sortOrder, now, now]
      });
    }
  }

  // 7. Standard Demo Accounts (Authentication via Google OAuth / Gmail)
  const usersData = [
    {
      email: "admin@company.com",
      fullName: "Alex Morgan (Admin)",
      roleId: roleMap["admin"],
      workshopId: wsMap["maintenance"],
      departmentId: depMap["import"],
      locale: "en",
    },
    {
      email: "buyer@company.com",
      fullName: "Elena Rostova (Lead Buyer)",
      roleId: roleMap["buyer"],
      workshopId: wsMap["warehouse"],
      departmentId: depMap["ukraine"],
      locale: "en",
    },
    {
      email: "shop@company.com",
      fullName: "Taras Shevchenko (Shop Manager)",
      roleId: roleMap["workshop_master"],
      workshopId: wsMap["assembly"],
      departmentId: depMap["ukraine"],
      locale: "en",
    },
    {
      email: "supervisor@company.com",
      fullName: "Taras Shevchenko (Supervisor)",
      roleId: roleMap["workshop_master"],
      workshopId: wsMap["assembly"],
      departmentId: depMap["ukraine"],
      locale: "en",
    },
    {
      email: "requester@company.com",
      fullName: "David Miller (Hardware Engineer)",
      roleId: roleMap["requester"],
      workshopId: wsMap["electronics"],
      departmentId: depMap["import"],
      locale: "en",
    },
    {
      email: "engineer@company.com",
      fullName: "David Miller (Hardware Engineer)",
      roleId: roleMap["requester"],
      workshopId: wsMap["electronics"],
      departmentId: depMap["import"],
      locale: "en",
    },
    {
      email: "test@localhost",
      fullName: "Quick Test Account",
      roleId: roleMap["admin"],
      workshopId: wsMap["assembly"],
      departmentId: depMap["import"],
      locale: "en",
    }
  ];

  const userMap = {};
  for (const u of usersData) {
    const ex = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [u.email] });
    if (ex.rows.length > 0) {
      await client.execute({
        sql: "UPDATE users SET full_name = ?, password_hash = NULL, role_id = ?, workshop_id = ?, department_id = ?, locale = ?, is_active = 1, updated_at = ? WHERE email = ?",
        args: [u.fullName, u.roleId, u.workshopId, u.departmentId, u.locale, now, u.email]
      });
      userMap[u.email] = ex.rows[0].id;
    } else {
      const ins = await client.execute({
        sql: "INSERT INTO users (email, full_name, password_hash, role_id, workshop_id, department_id, locale, is_active, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?) RETURNING id;",
        args: [u.email, u.fullName, u.roleId, u.workshopId, u.departmentId, u.locale, now, now]
      });
      userMap[u.email] = ins.rows[0].id;
    }
  }

  // 8. Realistic Nomenclature items
  const nomenclatureItems = [
    {
      name: "Siemens SIMATIC S7-1200 PLC CPU 1214C DC/DC/DC",
      partNumber: "6ES7214-1AG40-0XB0",
      basCode: "00-001248",
      manufacturer: "Siemens",
      unit: "pcs",
      status: "active",
      lastPrice: "485.00",
      lastCurrency: "EUR",
      usageCount: 14,
      searchKey: "siemens simatic s7 1200 plc cpu 1214c dcdcdc 6es72141ag400xb0 00001248",
      description: "Compact programmable logic controller for industrial automation, 14 DI / 10 DO / 2 AI.",
      specs: "Power supply: 24V DC, Work memory: 100 KB, PROFINET onboard."
    },
    {
      name: "Festo Compact Pneumatic Cylinder ADN-32-50-I-P-A",
      partNumber: "ADN-32-50",
      basCode: "00-003412",
      manufacturer: "Festo",
      unit: "pcs",
      status: "active",
      lastPrice: "92.50",
      lastCurrency: "EUR",
      usageCount: 9,
      searchKey: "festo compact pneumatic cylinder adn 32 50 ipa adn3250 00003412",
      description: "Double-acting compact cylinder according to ISO 21287 with elastic cushioning rings.",
      specs: "Piston diameter: 32 mm, Stroke: 50 mm, Operating pressure: 0.6 to 10 bar."
    },
    {
      name: "SKF Deep Groove Ball Bearing 6205-2RSH",
      partNumber: "6205-2RSH",
      basCode: "00-000854",
      manufacturer: "SKF",
      unit: "pcs",
      status: "active",
      lastPrice: "14.20",
      lastCurrency: "EUR",
      usageCount: 28,
      searchKey: "skf deep groove ball bearing 6205 2rsh 62052rsh 00000854",
      description: "High-precision single row deep groove ball bearing with contact rubber seals on both sides.",
      specs: "Bore diameter: 25 mm, Outer diameter: 52 mm, Width: 15 mm."
    },
    {
      name: "Omron E2B Proximity Inductive Sensor M12 PNP NO",
      partNumber: "E2B-M12KS04-WP-B1",
      basCode: "00-005619",
      manufacturer: "Omron",
      unit: "pcs",
      status: "active",
      lastPrice: "28.00",
      lastCurrency: "EUR",
      usageCount: 19,
      searchKey: "omron e2b proximity inductive sensor m12 pnp no e2bm12ks04wpb1 00005619",
      description: "Standard nickel-brass cylindrical inductive sensor, flush mount, 4mm sensing distance.",
      specs: "Thread size: M12, Output: PNP NO, Pre-wired 2m cable, IP67."
    },
    {
      name: "Schneider Electric TeSys D Contactor 3P 25A 24VDC",
      partNumber: "LC1D25BD",
      basCode: "00-002190",
      manufacturer: "Schneider Electric",
      unit: "pcs",
      status: "active",
      lastPrice: "64.00",
      lastCurrency: "EUR",
      usageCount: 7,
      searchKey: "schneider electric tesys d contactor 3p 25a 24vdc lc1d25bd 00002190",
      description: "3-pole contactor for motor control up to 11kW @ 400V AC-3, with 24V DC standard coil.",
      specs: "Rated operational current: 25A, Auxiliary contacts: 1 NO + 1 NC."
    },
    {
      name: "Weidmüller Terminal Blocks WDU 2.5 DIN Rail",
      partNumber: "1020000000",
      basCode: "00-004381",
      manufacturer: "Weidmüller",
      unit: "pcs",
      status: "active",
      lastPrice: "1.15",
      lastCurrency: "EUR",
      usageCount: 160,
      searchKey: "weidmuller terminal blocks wdu 2.5 din rail 1020000000 00004381",
      description: "Standard screw-connection feed-through terminal block for 0.5-2.5 mm² wire.",
      specs: "Rated voltage: 800V, Rated current: 24A, Color: Dark beige."
    },
    {
      name: "Lapp Group Olflex Classic 110 Control Cable 4G1.5",
      partNumber: "1119304",
      basCode: "00-006277",
      manufacturer: "Lapp Group",
      unit: "m",
      status: "active",
      lastPrice: "2.40",
      lastCurrency: "EUR",
      usageCount: 350,
      searchKey: "lapp group olflex classic 110 control cable 4g1.5 1119304 00006277",
      description: "VDE-registered flexible PVC control cable with numbered cores and protective earth conductor.",
      specs: "Conductors: 4 x 1.5 mm², Flame retardant according to IEC 60332-1-2."
    },
    {
      name: "Bosch Professional GWS 750 Angle Grinder 125mm",
      partNumber: "0601394000",
      basCode: "00-008102",
      manufacturer: "Bosch",
      unit: "pcs",
      status: "active",
      lastPrice: "75.00",
      lastCurrency: "EUR",
      usageCount: 5,
      searchKey: "bosch professional gws 750 angle grinder 125mm 0601394000 00008102",
      description: "Heavy-duty 750W corded angle grinder with ergonomic grip for maintenance workshops.",
      specs: "No-load speed: 11,000 rpm, Disc diameter: 125 mm, Weight: 1.8 kg."
    },
    {
      name: "3M Aura 9320+ FFP2 Particulate Respirator",
      partNumber: "9320+",
      basCode: "00-009115",
      manufacturer: "3M",
      unit: "pack",
      status: "active",
      lastPrice: "24.50",
      lastCurrency: "EUR",
      usageCount: 42,
      searchKey: "3m aura 9320+ ffp2 particulate respirator 9320+ 00009115",
      description: "Foldable 3-panel design dust and mist respirator, box of 20 units.",
      specs: "Protection class: FFP2 NR D, EN 149:2001+A1:2009."
    },
    {
      name: "Mean Well HDR-60-24 Industrial DIN Rail Power Supply",
      partNumber: "HDR-60-24",
      basCode: "00-007421",
      manufacturer: "Mean Well",
      unit: "pcs",
      status: "active",
      lastPrice: "21.90",
      lastCurrency: "EUR",
      usageCount: 22,
      searchKey: "mean well hdr 60 24 industrial din rail power supply hdr6024 00007421",
      description: "Ultra-slim 60W step-shape DIN rail power supply with universal AC input.",
      specs: "Output: 24V DC, 2.5A, Efficiency: 90%, Width: 52.5 mm (3SU)."
    }
  ];

  const nomMap = {};
  for (const n of nomenclatureItems) {
    const res = await client.execute({
      sql: `INSERT INTO nomenclature (
        name, part_number, bas_code, manufacturer, unit, status,
        last_price, last_currency, last_price_at, usage_count, search_key,
        description, specs, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id;`,
      args: [
        n.name, n.partNumber, n.basCode, n.manufacturer, n.unit, n.status,
        n.lastPrice, n.lastCurrency, twoDaysAgo, n.usageCount, n.searchKey,
        n.description, n.specs, userMap["admin@company.com"], userMap["buyer@company.com"], tenDaysAgo, twoDaysAgo
      ]
    });
    nomMap[n.partNumber] = res.rows[0].id;
  }

  // 9. Create Requests across diverse workflow statuses
  const requestsData = [
    {
      number: "REQ-2026-001",
      authorEmail: "shop@company.com",
      assigneeEmail: "buyer@company.com",
      depCode: "import",
      wsCode: "assembly",
      status: "purchasing",
      priority: "urgent",
      desiredDate: "2026-10-28",
      comment: "Urgent replacement components for Assembly Line 3 conveyor drive failure.",
      createdAt: twoDaysAgo,
      submittedAt: twoDaysAgo + 1800000,
      items: [
        {
          name: "Siemens SIMATIC S7-1200 PLC CPU 1214C DC/DC/DC",
          partNumber: "6ES7214-1AG40-0XB0",
          quantity: "2",
          unit: "pcs",
          unitPrice: "485.00",
          currency: "EUR",
          nomId: nomMap["6ES7214-1AG40-0XB0"],
          comment: "Main CPU for Conveyor 3 PLC rack"
        },
        {
          name: "Festo Compact Pneumatic Cylinder ADN-32-50-I-P-A",
          partNumber: "ADN-32-50",
          quantity: "4",
          unit: "pcs",
          unitPrice: "92.50",
          currency: "EUR",
          nomId: nomMap["ADN-32-50"],
          comment: "Stopper mechanism actuators"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Request created by workshop manager", user: "shop@company.com", time: twoDaysAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Request submitted for procurement review", user: "shop@company.com", time: twoDaysAgo + 1800000 },
        { type: "assign", from: null, to: null, msg: "Assigned to Elena Rostova (Lead Buyer)", user: "admin@company.com", time: twoDaysAgo + 3600000 },
        { type: "status_change", from: "submitted", to: "in_review", msg: "Supplier quotes requested from official Siemens distributor", user: "buyer@company.com", time: twoDaysAgo + 7200000 },
        { type: "status_change", from: "in_review", to: "purchasing", msg: "Commercial offer accepted, proforma invoice generated", user: "buyer@company.com", time: oneDayAgo }
      ]
    },
    {
      number: "REQ-2026-002",
      authorEmail: "shop@company.com",
      assigneeEmail: "buyer@company.com",
      depCode: "ukraine",
      wsCode: "maintenance",
      status: "ordered",
      priority: "high",
      desiredDate: "2026-10-25",
      comment: "Quarterly preventative maintenance stock: high-load bearings and lubricants.",
      createdAt: fiveDaysAgo,
      submittedAt: fiveDaysAgo + 1000000,
      items: [
        {
          name: "SKF Deep Groove Ball Bearing 6205-2RSH",
          partNumber: "6205-2RSH",
          quantity: "24",
          unit: "pcs",
          unitPrice: "14.20",
          currency: "EUR",
          nomId: nomMap["6205-2RSH"],
          comment: "For motor overhauls"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Maintenance request created", user: "shop@company.com", time: fiveDaysAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Submitted for processing", user: "shop@company.com", time: fiveDaysAgo + 1000000 },
        { type: "status_change", from: "submitted", to: "purchasing", msg: "Purchase approved by chief engineer", user: "buyer@company.com", time: fiveDaysAgo + 86400000 },
        { type: "status_change", from: "purchasing", to: "ordered", msg: "PO #SKF-2026-88 issued. Expected delivery in 3 working days.", user: "buyer@company.com", time: twoDaysAgo }
      ]
    },
    {
      number: "REQ-2026-003",
      authorEmail: "requester@company.com",
      assigneeEmail: "buyer@company.com",
      depCode: "import",
      wsCode: "cnc",
      status: "completed",
      priority: "normal",
      desiredDate: "2026-10-18",
      comment: "Batch of inductive sensors and contactors for CNC 5-axis retrofit.",
      createdAt: tenDaysAgo,
      submittedAt: tenDaysAgo + 500000,
      items: [
        {
          name: "Omron E2B Proximity Inductive Sensor M12 PNP NO",
          partNumber: "E2B-M12KS04-WP-B1",
          quantity: "8",
          unit: "pcs",
          unitPrice: "28.00",
          currency: "EUR",
          nomId: nomMap["E2B-M12KS04-WP-B1"],
          comment: "Limit switches retrofit"
        },
        {
          name: "Schneider Electric TeSys D Contactor 3P 25A 24VDC",
          partNumber: "LC1D25BD",
          quantity: "4",
          unit: "pcs",
          unitPrice: "64.00",
          currency: "EUR",
          nomId: nomMap["LC1D25BD"],
          comment: "Coolant pump starter"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Request created", user: "requester@company.com", time: tenDaysAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Submitted", user: "requester@company.com", time: tenDaysAgo + 500000 },
        { type: "status_change", from: "submitted", to: "ordered", msg: "Shipped by supplier via DHL Express", user: "buyer@company.com", time: fiveDaysAgo },
        { type: "status_change", from: "ordered", to: "completed", msg: "Goods received at central warehouse and verified by engineer", user: "buyer@company.com", time: oneDayAgo }
      ]
    },
    {
      number: "REQ-2026-004",
      authorEmail: "requester@company.com",
      assigneeEmail: "buyer@company.com",
      depCode: "ukraine",
      wsCode: "electronics",
      status: "in_review",
      priority: "normal",
      desiredDate: "2026-10-30",
      comment: "Wiring materials for automated testing station cabinet.",
      createdAt: oneDayAgo,
      submittedAt: oneDayAgo + 600000,
      items: [
        {
          name: "Lapp Group Olflex Classic 110 Control Cable 4G1.5",
          partNumber: "1119304",
          quantity: "150",
          unit: "m",
          unitPrice: "2.40",
          currency: "EUR",
          nomId: nomMap["1119304"],
          comment: "Internal cabinet wiring"
        },
        {
          name: "Weidmüller Terminal Blocks WDU 2.5 DIN Rail",
          partNumber: "1020000000",
          quantity: "80",
          unit: "pcs",
          unitPrice: "1.15",
          currency: "EUR",
          nomId: nomMap["1020000000"],
          comment: "Distribution block rail"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Request drafted", user: "requester@company.com", time: oneDayAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Submitted for price checking", user: "requester@company.com", time: oneDayAgo + 600000 },
        { type: "status_change", from: "submitted", to: "in_review", msg: "Verifying cable drum availability with local distributor", user: "buyer@company.com", time: oneHourAgo }
      ]
    },
    {
      number: "REQ-2026-005",
      authorEmail: "shop@company.com",
      assigneeEmail: null,
      depCode: "ukraine",
      wsCode: "assembly",
      status: "submitted",
      priority: "normal",
      desiredDate: "2026-11-05",
      comment: "Certified PPE respirators for sanding and paint booth personnel.",
      createdAt: oneHourAgo,
      submittedAt: oneHourAgo + 120000,
      items: [
        {
          name: "3M Aura 9320+ FFP2 Particulate Respirator",
          partNumber: "9320+",
          quantity: "15",
          unit: "pack",
          unitPrice: "24.50",
          currency: "EUR",
          nomId: nomMap["9320+"],
          comment: "Box of 20 units each"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Request created", user: "shop@company.com", time: oneHourAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Awaiting assignment to buyer", user: "shop@company.com", time: oneHourAgo + 120000 }
      ]
    },
    {
      number: "REQ-2026-006",
      authorEmail: "requester@company.com",
      assigneeEmail: "buyer@company.com",
      depCode: "import",
      wsCode: "cnc",
      status: "needs_info",
      priority: "normal",
      desiredDate: "2026-11-01",
      comment: "Additional angle grinder and accessories for deburring station.",
      createdAt: twoDaysAgo,
      submittedAt: twoDaysAgo + 200000,
      items: [
        {
          name: "Bosch Professional GWS 750 Angle Grinder 125mm",
          partNumber: "0601394000",
          quantity: "2",
          unit: "pcs",
          unitPrice: "75.00",
          currency: "EUR",
          nomId: nomMap["0601394000"],
          comment: "Requires quick-locking nut"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Request created", user: "requester@company.com", time: twoDaysAgo },
        { type: "submitted", from: "draft", to: "submitted", msg: "Submitted", user: "requester@company.com", time: twoDaysAgo + 200000 },
        { type: "clarification", from: "submitted", to: "needs_info", msg: "Please specify if 110V or 230V model is required for your workshop station.", user: "buyer@company.com", time: oneDayAgo }
      ]
    },
    {
      number: "REQ-2026-007",
      authorEmail: "requester@company.com",
      assigneeEmail: null,
      depCode: "import",
      wsCode: "electronics",
      status: "draft",
      priority: "normal",
      desiredDate: "2026-11-15",
      comment: "Spare DIN rail power supplies for upcoming factory expansion.",
      createdAt: oneHourAgo,
      submittedAt: null,
      items: [
        {
          name: "Mean Well HDR-60-24 Industrial DIN Rail Power Supply",
          partNumber: "HDR-60-24",
          quantity: "5",
          unit: "pcs",
          unitPrice: "21.90",
          currency: "EUR",
          nomId: nomMap["HDR-60-24"],
          comment: "For backup stocks"
        }
      ],
      events: [
        { type: "created", from: null, to: null, msg: "Draft created by engineer", user: "requester@company.com", time: oneHourAgo }
      ]
    }
  ];

  for (const r of requestsData) {
    const authorId = userMap[r.authorEmail];
    const assigneeId = r.assigneeEmail ? userMap[r.assigneeEmail] : null;
    const depId = depMap[r.depCode];
    const wsId = wsMap[r.wsCode];

    const ins = await client.execute({
      sql: `INSERT INTO requests (
        number, author_id, department_id, workshop_id, assignee_id, status, priority,
        comment, desired_date, submitted_at, closed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id;`,
      args: [
        r.number, authorId, depId, wsId, assigneeId, r.status, r.priority,
        r.comment, r.desiredDate, r.submittedAt, r.status === "completed" ? oneDayAgo : null, r.createdAt, now
      ]
    });
    const requestId = ins.rows[0].id;

    for (let i = 0; i < r.items.length; i++) {
      const it = r.items[i];
      await client.execute({
        sql: `INSERT INTO request_items (
          request_id, nomenclature_id, position, name, part_number, quantity, unit,
          unit_price, currency, comment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          requestId, it.nomId, i + 1, it.name, it.partNumber, it.quantity, it.unit,
          it.unitPrice, it.currency, it.comment, r.createdAt, r.createdAt
        ]
      });
    }

    for (const ev of r.events) {
      await client.execute({
        sql: `INSERT INTO request_events (
          request_id, user_id, type, from_status, to_status, message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        args: [
          requestId, userMap[ev.user], ev.type, ev.from, ev.to, ev.msg, ev.time
        ]
      });
    }
  }

  // 10. Sample audit log records
  await client.execute({
    sql: `INSERT INTO audit_log (user_id, action, entity_type, entity_id, summary, created_at)
          VALUES (?, 'auth.login', 'user', ?, 'Successful web login from 127.0.0.1', ?);`,
    args: [userMap["admin@company.com"], String(userMap["admin@company.com"]), oneHourAgo]
  });
  await client.execute({
    sql: `INSERT INTO audit_log (user_id, action, entity_type, entity_id, summary, created_at)
          VALUES (?, 'request.status_change', 'request', 'REQ-2026-001', 'Changed status from in_review to purchasing', ?);`,
    args: [userMap["buyer@company.com"], oneDayAgo]
  });

  // 11. Initial Notifications
  await client.execute({
    sql: `INSERT INTO notifications (user_id, request_id, type, title, body, is_read, created_at)
          VALUES (?, 5, 'request.submitted', 'Заявка REQ-2026-005: Надіслана на розгляд', 'Taras Shevchenko надіслав(ла) заявку на обробку', 0, ?);`,
    args: [userMap["admin@company.com"], oneHourAgo]
  });
  await client.execute({
    sql: `INSERT INTO notifications (user_id, request_id, type, title, body, is_read, created_at)
          VALUES (?, 1, 'request.status', 'Заявка REQ-2026-001: Передано в закупівлю', 'Отримано рахунок-фактуру від постачальника Siemens', 0, ?);`,
    args: [userMap["shop@company.com"], oneDayAgo]
  });
  await client.execute({
    sql: `INSERT INTO notifications (user_id, request_id, type, title, body, is_read, created_at)
          VALUES (?, 5, 'request.submitted', 'Заявка REQ-2026-005: Нова заявка', 'Очікує призначення відповідального закупника', 0, ?);`,
    args: [userMap["buyer@company.com"], oneHourAgo]
  });
  await client.execute({
    sql: `INSERT INTO notifications (user_id, request_id, type, title, body, is_read, created_at)
          VALUES (?, 6, 'request.status', 'Заявка REQ-2026-006: Потребує уточнення', 'Уточніть, будь ласка, модель на 110V чи 230V для робочої станції', 0, ?);`,
    args: [userMap["requester@company.com"], twoHoursAgo]
  });

  // 12. Seed default system settings
  const defaultSettings = JSON.stringify({
    defaultLocale: process.env.DEFAULT_LOCALE === "uk" ? "uk" : "en",
    editableStatuses: ["draft", "needs_info"],
    requiredItemFields: [],
    autoApproveNomenclature: true,
    maxUploadMb: 8,
    sessionTimeoutMinutes: 30,
    requireUserApproval: false
  });
  await client.execute({
    sql: `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('system', ?, ?);`,
    args: [defaultSettings, now]
  });

  await client.execute("PRAGMA foreign_keys = ON;");
  console.log("Realistic clean demo database successfully initialized!");
  console.log("--------------------------------------------------");
  console.log("Demo Accounts (Passwordless Google / Gmail authentication):");
  console.log(" - Admin:        admin@company.com (Alex Morgan)");
  console.log(" - Buyer:        buyer@company.com (Elena Rostova)");
  console.log(" - Shop Manager: shop@company.com  (Taras Shevchenko)");
  console.log(" - Requester:    requester@company.com (David Miller)");
  console.log("--------------------------------------------------");

  client.close();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
