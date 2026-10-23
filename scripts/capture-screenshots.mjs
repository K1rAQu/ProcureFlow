import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function login() {
  const res = await fetch("http://127.0.0.1:3000/api/auth/google/dev", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@company.com", fullName: "Alex Morgan (Admin)" })
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("No cookie returned: status " + res.status);
  const match = cookie.match(/procurement_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getFirstRequestId() {
  const dbPath = resolve(process.cwd(), "data", "procurement.db");
  const client = createClient({ url: `file:${dbPath}` });
  const res = await client.execute("SELECT id FROM requests ORDER BY id ASC LIMIT 1;");
  client.close();
  return res.rows[0]?.id || 1;
}

async function captureAll() {
  const firstReqId = await getFirstRequestId();
  const PAGES_TO_CAPTURE = [
    { name: "dashboard.png", path: "/", delay: 2000 },
    { name: "kanban-board.png", path: "/all-requests", delay: 2000 },
    { name: "table-view.png", path: "/all-requests?view=table", delay: 2000 },
    { name: "requests-filter.png", path: "/requests?dateFrom=2026-10-01", delay: 2000 },
    { name: "request-detail.png", path: `/requests/${firstReqId}`, delay: 2500 },
    { name: "new-request.png", path: "/requests/new", delay: 1800 },
    { name: "nomenclature.png", path: "/nomenclature", delay: 2000 },
    { name: "admin-users.png", path: "/admin?tab=users", delay: 2000 },
    { name: "admin-settings.png", path: "/admin?tab=settings", delay: 2000 },
    { name: "admin-maintenance.png", path: "/admin?tab=maintenance", delay: 2000 },
    { name: "audit-log.png", path: "/audit", delay: 2000 },
  ];
  console.log("Logging in as admin@company.com...");
  const sessionToken = await login();

  const tmpUserData = mkdtempSync(join(tmpdir(), "edge-cdp-shots-"));
  const edge = spawn(EDGE_PATH, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${tmpUserData}`,
    "--window-size=1440,920",
    "--device-scale-factor=1.25",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ]);

  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch("http://127.0.0.1:9222/json/version");
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch (e) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (!versionData) throw new Error("Could not connect to Edge DevTools port");

    const listRes = await fetch("http://127.0.0.1:9222/json/list");
    const pages = await listRes.json();
    const pageTarget = pages.find(p => p.type === "page") || pages[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const callbacks = new Map();
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && callbacks.has(data.id)) {
        const cb = callbacks.get(data.id);
        callbacks.delete(data.id);
        cb(data);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        callbacks.set(reqId, resolve);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send("Network.enable");
    await send("Page.enable");

    // Set auth cookie & english locale
    await send("Network.setCookie", {
      name: "procurement_session",
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true
    });
    await send("Network.setCookie", {
      name: "procurement_locale",
      value: "en",
      domain: "127.0.0.1",
      path: "/"
    });

    const outDir = resolve(process.cwd(), "docs", "screenshots");
    mkdirSync(outDir, { recursive: true });

    for (const page of PAGES_TO_CAPTURE) {
      console.log(`Navigating to ${page.path} -> ${page.name}...`);
      await send("Page.navigate", { url: `http://127.0.0.1:3000${page.path}` });
      await new Promise(r => setTimeout(r, page.delay));

      const shot = await send("Page.captureScreenshot", { format: "png" });
      const buffer = Buffer.from(shot.result.data, "base64");
      const filePath = join(outDir, page.name);
      writeFileSync(filePath, buffer);
      console.log(`  ✓ Saved ${page.name} (${Math.round(buffer.length / 1024)} KB)`);
    }

    // Also capture notifications popover open
    console.log("Capturing notifications popover...");
    await send("Page.navigate", { url: "http://127.0.0.1:3000/" });
    await new Promise(r => setTimeout(r, 2000));
    await send("Runtime.evaluate", {
      expression: `(() => {
        const btn = document.querySelector('header .relative button');
        if (btn) btn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 800));
    const notifShot = await send("Page.captureScreenshot", { format: "png" });
    const notifBuffer = Buffer.from(notifShot.result.data, "base64");
    writeFileSync(join(outDir, "notifications-open.png"), notifBuffer);
    console.log(`  ✓ Saved notifications-open.png (${Math.round(notifBuffer.length / 1024)} KB)`);

    // Also capture login page without session
    console.log("Capturing login page...");
    await send("Network.deleteCookies", { name: "procurement_session", domain: "127.0.0.1" });
    await send("Page.navigate", { url: "http://127.0.0.1:3000/login" });
    await new Promise(r => setTimeout(r, 1500));
    const loginShot = await send("Page.captureScreenshot", { format: "png" });
    const loginBuffer = Buffer.from(loginShot.result.data, "base64");
    writeFileSync(join(outDir, "login.png"), loginBuffer);
    console.log(`  ✓ Saved login.png (${Math.round(loginBuffer.length / 1024)} KB)`);

    ws.close();
  } finally {
    edge.kill();
    try {
      rmSync(tmpUserData, { recursive: true, force: true });
    } catch {}
  }
}

captureAll().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
