/**
 * Наскрізний сценарій роботи системи за HTTP API.
 * Запуск (сервер має бути вже запущений):
 *   node tests/e2e.mjs http://127.0.0.1:3000
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
    console.error(`FAIL  ${name}${extra ? ` → ${JSON.stringify(extra).slice(0, 400)}` : ""}`);
  }
}

function createClient() {
  const jar = new Map();
  return {
    cookies: jar,
    async request(path, options = {}) {
      const headers = new Headers(options.headers ?? {});
      if (jar.size) headers.set("cookie", [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "));
      if (options.json !== undefined) {
        headers.set("content-type", "application/json");
      }
      const response = await fetch(`${BASE}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        redirect: "manual",
      });
      for (const [key, value] of response.headers) {
        if (key.toLowerCase() !== "set-cookie") continue;
        const [pair] = value.split(";");
        const index = pair.indexOf("=");
        jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: response.status, data };
    },
  };
}

const admin = createClient();
const employee = createClient();
const stamp = Date.now();

const run = async () => {
  /* 1. Початкове налаштування / вхід адміністратора */
  const status = await admin.request("/api/setup");
  let adminEmail = `admin+${stamp}@company.test`;
  const adminPassword = "Admin12345!";
  if (status.data.initialized) {
    console.log("  i   система вже ініціалізована — використовуйте наявного адміністратора");
    adminEmail = process.env.E2E_ADMIN_EMAIL ?? adminEmail;
    let login = await admin.request("/api/auth/login", {
      method: "POST",
      json: { email: adminEmail, password: process.env.E2E_ADMIN_PASSWORD ?? adminPassword },
    });
    if (login.status !== 200) {
      login = await admin.request("/api/auth/google/dev", {
        method: "POST",
        json: { email: "admin@google.com", fullName: "E2E Адміністратор" },
      });
    }
    check("вхід адміністратора", login.status === 200, login.data);
  } else {
    const setup = await admin.request("/api/setup", {
      method: "POST",
      json: { email: adminEmail, fullName: "Системний адміністратор", password: adminPassword },
    });
    check("створення першого адміністратора", setup.status === 201, setup.data);
  }

  /* 2. Неавторизований доступ заборонено */
  const anonymous = await fetch(`${BASE}/api/requests`, { redirect: "manual" });
  check("анонімний доступ до заявок заборонено", anonymous.status === 401);

  /* 3. Довідники: цех створює адміністратор */
  const workshop = await admin.request("/api/admin/directories/workshops", {
    method: "POST",
    json: { code: `shop-${stamp}`, name: "Цех складання", nameUk: "Цех складання", nameRu: "Цех складання", isActive: true, sortOrder: 10 },
  });
  check("створення виробничого цеху", workshop.status === 201, workshop.data);
  const workshopId = workshop.data.id;

  const departments = await admin.request("/api/admin/directories/departments");
  check("напрями закупівлі заведені", departments.data.items.length >= 2, departments.data);
  const importDepartment = departments.data.items.find((item) => item.code === "import");
  const ukraineDepartment = departments.data.items.find((item) => item.code === "ukraine");
  check("наявні напрями Імпорт та Україна", Boolean(importDepartment && ukraineDepartment));

  /* 4. Звичайний користувач */
  const roles = await admin.request("/api/admin/roles");
  const userRole = roles.data.items.find((role) => role.code === "user");
  const employeeEmail = `user+${stamp}@company.test`;
  const createdUser = await admin.request("/api/admin/users", {
    method: "POST",
    json: {
      email: employeeEmail,
      fullName: "Іван Петренко",
      password: "User12345!",
      roleId: userRole.id,
      workshopId,
      isActive: true,
    },
  });
  check("адміністратор створює користувача", createdUser.status === 201, createdUser.data);

  const employeeLogin = await employee.request("/api/auth/login", {
    method: "POST",
    json: { email: employeeEmail, password: "User12345!" },
  });
  check("вхід користувача", employeeLogin.status === 200, employeeLogin.data);

  /* 5. Перевірка прав: користувач не має доступу до адмінки */
  const forbidden = await employee.request("/api/admin/users");
  check("користувач не має доступу до адмін-API", forbidden.status === 403, forbidden.data);
  const forbiddenEscalation = await employee.request("/api/admin/directories/workshops", {
    method: "POST",
    json: { code: `hack-${stamp}`, name: "Злам", nameUk: "Злам", nameRu: "Злам" },
  });
  check("користувач не може змінювати довідники", forbiddenEscalation.status === 403);

  /* 6. Створення заявки з кількома позиціями */
  const created = await employee.request("/api/requests", {
    method: "POST",
    json: {
      departmentId: importDepartment.id,
      workshopId,
      priority: "high",
      comment: "Терміново для лінії складання",
      submit: true,
      idempotencyKey: `e2e-${stamp}`,
      items: [
        {
          name: `Підшипник SKF ${stamp}`,
          partNumber: `SKF-${stamp}`,
          quantity: "4",
          unitPrice: "250.50",
          currency: "EUR",
          url: "https://example.com/bearing",
          comment: "Із захистом 2RS",
        },
        {
          name: `Кабель ВВГ ${stamp}`,
          quantity: "20",
          unit: "м",
          unitPrice: "35",
          currency: "UAH",
        },
      ],
    },
  });
  check("створення заявки з кількома позиціями", created.status === 201, created.data);
  const requestId = created.data.id;
  check("заявці присвоєно номер", /REQ-\d{4}-\d{5}/.test(created.data.number ?? ""), created.data);

  /* 7. Захист від повторного надсилання форми */
  const duplicateSubmit = await employee.request("/api/requests", {
    method: "POST",
    json: {
      departmentId: importDepartment.id,
      workshopId,
      submit: true,
      idempotencyKey: `e2e-${stamp}`,
      items: [{ name: `Підшипник SKF ${stamp}`, quantity: "4", nomenclatureId: null, confirmNewNomenclature: true }],
    },
  });
  check(
    "повторне надсилання з тим самим ключем не створює дубль",
    duplicateSubmit.data?.id === requestId,
    duplicateSubmit.data,
  );

  /* 8. Номенклатура збережена та знаходиться пошуком */
  const search = await employee.request(`/api/nomenclature?q=${encodeURIComponent(`SKF-${stamp}`)}`);
  check("номенклатура збережена та знаходиться за артикулом", search.data.items.length >= 1, search.data);
  const card = search.data.items[0];
  check("картка містить останню ціну", card?.lastPrice !== null, card);

  /* 9. Захист від дублікатів при повторному введенні тієї самої назви */
  const duplicateAttempt = await employee.request("/api/requests", {
    method: "POST",
    json: {
      departmentId: ukraineDepartment.id,
      workshopId,
      items: [{ name: `Підшипник SKF ${stamp}`, partNumber: `SKF-${stamp}`, quantity: "1" }],
    },
  });
  check("повтор назви призводить до попередження про дублікат", duplicateAttempt.status === 409, duplicateAttempt.data);
  check(
    "сервер повернув кандидатів для вибору",
    (duplicateAttempt.data?.details?.conflicts?.[0]?.candidates ?? []).length > 0,
    duplicateAttempt.data,
  );

  /* 10. Повторне замовлення з вибором наявної картки */
  const reorder = await employee.request("/api/requests", {
    method: "POST",
    json: {
      departmentId: ukraineDepartment.id,
      workshopId,
      submit: true,
      items: [{ nomenclatureId: card.id, name: card.name, quantity: "2", unitPrice: "260", currency: "EUR" }],
    },
  });
  check("повторна заявка за збереженою номенклатурою", reorder.status === 201, reorder.data);

  /* 11. Картка номенклатури не змінюється без підтвердження */
  const cardAfter = await employee.request(`/api/nomenclature/${card.id}`);
  check(
    "ціна картки не перезаписана даними заявки",
    String(Number(cardAfter.data.lastPrice)) === String(Number(card.lastPrice)),
    { before: card.lastPrice, after: cardAfter.data.lastPrice },
  );

  /* 12. Маршрутизація: заявка відображається у розділі свого напряму */
  const byDepartment = await admin.request(`/api/requests?scope=all&departmentId=${importDepartment.id}`);
  check(
    "заявка потрапила у розділ напряму «Імпорт»",
    byDepartment.data.items.some((item) => item.id === requestId),
    byDepartment.data?.items?.length,
  );

  /* 13. Користувач не бачить чужих заявок */
  const otherUserView = await employee.request(`/api/requests?scope=all`);
  check(
    "у загальному списку користувач бачить лише свої заявки",
    otherUserView.data.items.every((item) => item.authorName === "Іван Петренко"),
  );

  /* 14. Життєвий цикл заявки */
  const invalidTransition = await admin.request(`/api/requests/${requestId}/status`, {
    method: "POST",
    json: { status: "completed" },
  });
  check("неприпустимий перехід статусу відхилено", invalidTransition.status === 409, invalidTransition.data);

  const toReview = await admin.request(`/api/requests/${requestId}/status`, {
    method: "POST",
    json: { status: "in_review" },
  });
  check("заявка прийнята в обробку", toReview.status === 200, toReview.data);

  const needsInfoWithoutComment = await admin.request(`/api/requests/${requestId}/status`, {
    method: "POST",
    json: { status: "needs_info" },
  });
  check("уточнення без коментаря не приймається", needsInfoWithoutComment.status === 422);

  const needsInfo = await admin.request(`/api/requests/${requestId}/status`, {
    method: "POST",
    json: { status: "needs_info", comment: "Уточніть виробника кабелю" },
  });
  check("запитано уточнення", needsInfo.status === 200, needsInfo.data);

  const answer = await employee.request(`/api/requests/${requestId}/comments`, {
    method: "POST",
    json: { message: "Виробник — Південкабель", type: "answer" },
  });
  check("автор відповів на уточнення", answer.status === 200, answer.data);

  for (const next of ["in_review", "purchasing", "ordered", "completed"]) {
    const step = await admin.request(`/api/requests/${requestId}/status`, { method: "POST", json: { status: next } });
    check(`перехід у статус ${next}`, step.status === 200, step.data);
  }

  /* 15. Історія заявки збережена */
  const detail = await admin.request(`/api/requests/${requestId}`);
  check("історія заявки містить усі події", detail.data.events.length >= 7, detail.data.events?.length);
  check("статус заявки — завершена", detail.data.status === "completed", detail.data.status);

  /* 16. Адміністратор архівує номенклатуру */
  const archived = await admin.request(`/api/nomenclature/${card.id}`, {
    method: "PATCH",
    json: { status: "archived" },
  });
  check("архівування номенклатури", archived.status === 200, archived.data);
  const afterArchive = await admin.request(`/api/nomenclature/${card.id}`);
  check("історія використання збережена після архівації", afterArchive.data.usage.length >= 1);

  /* 17. Об'єднання дублікатів */
  const extra = await admin.request("/api/nomenclature", {
    method: "POST",
    json: { name: `Підшипник SKF ${stamp} дубль`, partNumber: `SKF-${stamp}-D`, confirmDuplicate: true },
  });
  check("створення другої картки", extra.status === 201, extra.data);
  const merge = await admin.request("/api/nomenclature/merge", {
    method: "POST",
    json: { sourceId: extra.data.created.id, targetId: card.id },
  });
  check("об'єднання дублікатів", merge.status === 200, merge.data);

  /* 18. Завантаження файлів: перевірка типу та розмежування доступу */
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const imageForm = new FormData();
  imageForm.append("file", new Blob([png], { type: "image/png" }), "photo.png");
  const upload = await employee.request("/api/files", { method: "POST", body: imageForm });
  check("завантаження зображення", upload.status === 201, upload.data);
  const fileId = upload.data.id;

  const badForm = new FormData();
  badForm.append("file", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/png" }), "bad.png");
  const badUpload = await employee.request("/api/files", { method: "POST", body: badForm });
  check("файл із підміненим типом відхилено", badUpload.status === 415, badUpload.data);

  const stranger = createClient();
  const strangerRole = roles.data.items.find((role) => role.code === "user");
  const strangerEmail = `stranger+${stamp}@company.test`;
  await admin.request("/api/admin/users", {
    method: "POST",
    json: {
      email: strangerEmail,
      fullName: "Сторонній Співробітник",
      password: "User12345!",
      roleId: strangerRole.id,
      isActive: true,
    },
  });
  await stranger.request("/api/auth/login", {
    method: "POST",
    json: { email: strangerEmail, password: "User12345!" },
  });
  const ownerAccess = await employee.request(`/api/files/${fileId}`);
  check("власник бачить своє вкладення", ownerAccess.status === 200);
  const strangerAccess = await stranger.request(`/api/files/${fileId}`);
  check("сторонній не бачить чуже вкладення", strangerAccess.status === 403, strangerAccess.data);
  const strangerRequest = await stranger.request(`/api/requests/${requestId}`);
  check("сторонній не бачить чужу заявку", strangerRequest.status === 403, strangerRequest.data);

  /* 19. Журнал дій та сповіщення */
  const audit = await admin.request("/api/notifications");
  check("сповіщення доступні", audit.status === 200);

  console.log(`\n${passed} passed, ${failures} failed`);
  if (failures) process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
