import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (!envUrl || envUrl.startsWith("postgres://") || envUrl.startsWith("postgresql://")) {
    const dataDir = resolve(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    return `file:${resolve(dataDir, "procurement.db")}`;
  }
  if (envUrl.startsWith("file:")) {
    const filePath = envUrl.slice(5);
    const resolvedPath = resolve(process.cwd(), filePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    return `file:${resolvedPath}`;
  }
  return envUrl;
}

const dbUrl = getDatabaseUrl();

const globalForDb = globalThis as typeof globalThis & {
  __procurementLibsqlClient?: Client;
};

export const client: Client =
  globalForDb.__procurementLibsqlClient ??
  createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__procurementLibsqlClient = client;
}

export const db = drizzle(client);
