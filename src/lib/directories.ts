import "server-only";
import { departments, unitsOfMeasurement, workshops } from "@/db/schema";
import { HttpError } from "./auth";

export type DirectoryKind = "workshops" | "departments" | "units";

/**
 * Таблицы цехов, отделов и единиц измерения имеют одинаковую структуру, поэтому справочниками
 * управляет один набор обработчиков.
 */
export function resolveTable(kind: string): typeof workshops {
  if (kind === "workshops") return workshops;
  if (kind === "departments") return departments as unknown as typeof workshops;
  if (kind === "units") return unitsOfMeasurement as unknown as typeof workshops;
  throw new HttpError(404, "unknown_directory");
}

export function isDirectoryKind(kind: string): kind is DirectoryKind {
  return kind === "workshops" || kind === "departments" || kind === "units";
}
