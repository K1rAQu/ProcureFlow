/**
 * Перевірка, що всі сторінки інтерфейсу відкриваються без помилок.
 * Запуск (сервер має бути запущений, база може бути порожньою):
 *   node tests/ui-smoke.mjs http://127.0.0.1:3000
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
let failures = 0;
let passed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${extra ? ` → ${String(extra).slice(0, 300)}` : ""}`);
  }
}

const jar = new Map();
async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (jar.size) headers.set("cookie", [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "));
  if (options.json !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    redirect: "manual",
  });
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== "set-cookie") continue;
    const [pair] = value.split(";");
    const index = pair.indexOf("=");
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const text = await response.text();
  return { status: response.status, text, location: response.headers.get("location") };
}

const stamp = Date.now();
const email = `ui+${stamp}@company.test`;
const password = "Admin12345!";

const run = async () => {
  const anonymous = await request("/");
  check("анонімний користувач перенаправляється на вхід", anonymous.status === 307 || anonymous.status === 302, anonymous.status);

  const state = await request("/api/setup");
  const initialized = JSON.parse(state.text).initialized;
  if (!initialized) {
    const setup = await request("/api/setup", {
      method: "POST",
      json: { email, fullName: "UI Адміністратор", password },
    });
    check("початкове налаштування", setup.status === 201, setup.text);
  } else {
    const loginEmail = process.env.UI_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? email;
    const loginPassword = process.env.UI_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? password;
    let login = await request("/api/auth/login", {
      method: "POST",
      json: { email: loginEmail, password: loginPassword },
    });
    if (login.status !== 200) {
      login = await request("/api/auth/google/dev", {
        method: "POST",
        json: { email: "admin@google.com", fullName: "UI Адміністратор" },
      });
    }
    check("вхід адміністратора", login.status === 200, login.text);
  }

  const workshop = await request("/api/admin/directories/workshops", {
    method: "POST",
    json: { code: `ui-${stamp}`, name: "Цех №1", nameUk: "Цех №1", nameRu: "Цех №1", isActive: true, sortOrder: 10 },
  });
  check("створення цеху", workshop.status === 201, workshop.text);
  const workshopId = JSON.parse(workshop.text).id;
  const departments = JSON.parse((await request("/api/admin/directories/departments")).text);
  const departmentId = departments.items[0].id;

  const created = await request("/api/requests", {
    method: "POST",
    json: {
      departmentId,
      workshopId,
      submit: true,
      items: [{ name: `UI тестова позиція ${stamp}`, partNumber: `UI-${stamp}`, quantity: "3", unitPrice: "12.5", currency: "UAH", confirmNewNomenclature: true }],
    },
  });
  check("створення заявки", created.status === 201, created.text);
  const requestId = JSON.parse(created.text).id;
  const nomenclature = JSON.parse((await request(`/api/nomenclature?q=UI-${stamp}`)).text);
  const nomenclatureId = nomenclature.items[0]?.id;

  const pages = [
    ["/", "Головна панель"],
    ["/requests", "Мої заявки"],
    ["/all-requests", "Усі заявки"],
    ["/requests/new", "Нова заявка"],
    [`/requests/${requestId}`, "REQ-"],
    [`/requests/${requestId}/edit`, "Редагування заявки"],
    ["/nomenclature", "Номенклатура"],
    [`/nomenclature/${nomenclatureId}`, "Картка номенклатури"],
    ["/admin?tab=users", "Користувачі"],
    ["/admin?tab=roles", "Ролі та права"],
    ["/admin?tab=workshops", "Виробничі цехи"],
    ["/admin?tab=departments", "Відділи закупівлі"],
    ["/admin?tab=pending", "Адміністрування"],
    ["/admin?tab=settings", "Налаштування системи"],
    ["/admin?tab=maintenance", "Обслуговування та бекап"],
    ["/audit", "Історія дій"],
    ["/login", "Вхід"],
  ];

  for (const [path, marker] of pages) {
    const page = await request(path);
    const ok = (page.status === 200 && page.text.includes(marker)) || (path === "/login" && page.status === 307);
    check(`сторінка ${path}`, ok, `${page.status} ${page.text.slice(0, 120)}`);
  }

  const exportRequests = await request("/api/export/requests?mine=1");
  check("експорт заявок у CSV", exportRequests.status === 200 && exportRequests.text.includes("Номер заявки"));

  const exportNom = await request("/api/export/nomenclature");
  check("експорт номенклатури у CSV", exportNom.status === 200 && exportNom.text.includes("Найменування номенклатури"));

  const maintenance = await request("/api/admin/maintenance");
  check("статистика обслуговування", maintenance.status === 200 && maintenance.text.includes("dbSizeBytes"));

  const createBackup = await request("/api/admin/backup", { method: "POST" });
  check("створення бекапу на сервері", createBackup.status === 201 && createBackup.text.includes("filename"));

  const backupList = await request("/api/admin/backup");
  check("список збережених бекапів", backupList.status === 200 && backupList.text.includes("backups"));

  const backupFilename = JSON.parse(createBackup.text).filename;
  const downloadBackup = await request(`/api/admin/backup?file=${backupFilename}`);
  check("завантаження збереженого бекапу", downloadBackup.status === 200);

  const deleteBackup = await request(`/api/admin/backup?file=${backupFilename}`, { method: "DELETE" });
  check("видалення бекапу із сервера", deleteBackup.status === 200);

  const logout = await request("/api/auth/logout", { method: "POST" });
  check("вихід із системи", logout.status === 200);

  const afterLogout = await request("/");
  check("після виходу перенаправляє на /login", afterLogout.status === 307 || afterLogout.status === 302);

  console.log(`\n${passed} passed, ${failures} failed`);
  if (failures) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
