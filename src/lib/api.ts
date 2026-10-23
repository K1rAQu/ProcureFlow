import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function jsonError(status: number, code: string, details?: unknown) {
  return NextResponse.json({ error: code, details: details ?? null }, { status });
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return NextResponse.json((result ?? {}) as object);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.status, error.code, error.details);
    }
    if (error instanceof ZodError) {
      return jsonError(422, "validation_error", error.issues);
    }
    console.error("[api]", error);
    return jsonError(500, "internal_error");
  }
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

export function parseIdParam(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "invalid_id");
  return id;
}
