import { NextResponse, type NextRequest } from "next/server";

// Приватні та локальні IP-адреси корпоративної мережі
const LOCAL_IPS = ["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"];

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (LOCAL_IPS.includes(ip)) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

// Кеш визначення IP для автономного режиму (в оперативній пам'яті)
type GeoCacheEntry = { country: string; isVpn: boolean; expires: number };
const geoCache = new Map<string, GeoCacheEntry>();

async function resolveStandaloneGeo(ip: string): Promise<{ country: string; isVpn: boolean }> {
  const cached = geoCache.get(ip);
  if (cached && cached.expires > Date.now()) {
    return { country: cached.country, isVpn: cached.isVpn };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,proxy,hosting`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as { status?: string; countryCode?: string; proxy?: boolean; hosting?: boolean };
      if (data.status === "success") {
        const country = String(data.countryCode || "").toUpperCase();
        const isVpn = Boolean(data.proxy || data.hosting);
        geoCache.set(ip, { country, isVpn, expires: Date.now() + 12 * 60 * 60 * 1000 });
        return { country, isVpn };
      }
    }
  } catch {
    // У разі таймауту або збою мережі не блокуємо користувача помилково
  }

  return { country: "", isVpn: false };
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Пропускаємо системні статичні ресурси Next.js
  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Режим блокування: "off" | "cloudflare" | "nginx" | "standalone"
  const mode = (process.env.GEO_RESTRICT_MODE || "off").toLowerCase();
  if (mode === "off" || mode === "false" || mode === "disabled") {
    return NextResponse.next();
  }

  // Дозволені країни (за замовчуванням тільки Україна: UA)
  const allowedCountries = (process.env.ALLOWED_COUNTRIES || "UA")
    .toUpperCase()
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const blockVpn = process.env.BLOCK_VPN === "true";

  // Визначаємо IP адресу
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = (
    request.headers.get("x-real-ip") ||
    (forwardedFor ? forwardedFor.split(",")[0].trim() : "") ||
    ""
  );

  // Локальні та корпоративні приватні мережі завжди мають вільний доступ
  if (isPrivateIp(realIp)) {
    return NextResponse.next();
  }

  let country = "";
  let isVpnDetected = false;

  if (mode === "cloudflare") {
    country = (request.headers.get("cf-ipcountry") || "").toUpperCase();
    const threat = Number(request.headers.get("cf-threat-score") || 0);
    if (threat > 30) isVpnDetected = true;
  } else if (mode === "nginx") {
    country = (
      request.headers.get("x-country-code") ||
      request.headers.get("x-geo-country") ||
      ""
    ).toUpperCase();
  } else if (mode === "standalone") {
    const geo = await resolveStandaloneGeo(realIp);
    country = geo.country;
    isVpnDetected = geo.isVpn;
  }

  // 1. Перевірка країни (якщо країна визначена і не входить до списку дозволених)
  if (country && !allowedCountries.includes(country)) {
    return new NextResponse(
      "Доступ обмежено. Вхід у корпоративну систему дозволено виключно з території України.",
      {
        status: 403,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  // 2. Перевірка VPN / Proxy
  if (blockVpn && isVpnDetected) {
    return new NextResponse(
      "Доступ обмежено. Використання анонімних VPN / Proxy заборонено політикою безпеки підприємства.",
      {
        status: 403,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
