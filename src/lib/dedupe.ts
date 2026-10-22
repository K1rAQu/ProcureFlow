/**
 * Нормализация и поиск возможных дубликатов номенклатуры.
 * Используется и на сервере (жёсткая проверка), и для подсказок в форме.
 */

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[`'"«»]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Артикул сравнивается без пробелов, дефисов и регистра. */
export function normalizePartNumber(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function buildSearchKey(input: {
  name: string;
  partNumber?: string | null;
  basCode?: string | null;
  manufacturer?: string | null;
}): string {
  return [
    normalizeText(input.name),
    normalizePartNumber(input.partNumber),
    normalizePartNumber(input.basCode),
    normalizeText(input.manufacturer),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);
}

function bigrams(value: string): Set<string> {
  const set = new Set<string>();
  const text = value.replace(/\s/g, "");
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2));
  return set;
}

/** Коэффициент Дайса на биграммах: 0..1 */
export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const first = bigrams(left);
  const second = bigrams(right);
  if (first.size === 0 || second.size === 0) return 0;
  let intersection = 0;
  for (const gram of first) if (second.has(gram)) intersection += 1;
  return (2 * intersection) / (first.size + second.size);
}

export type DuplicateCandidate = {
  id: number;
  name: string;
  partNumber: string | null;
  basCode?: string | null;
  manufacturer: string | null;
};

export type DuplicateMatch = DuplicateCandidate & {
  score: number;
  reason: "part_number" | "bas_code" | "name";
};

export const DUPLICATE_NAME_THRESHOLD = 0.82;

export function findDuplicates(
  input: { name: string; partNumber?: string | null; basCode?: string | null },
  candidates: DuplicateCandidate[],
  threshold = DUPLICATE_NAME_THRESHOLD,
): DuplicateMatch[] {
  const partKey = normalizePartNumber(input.partNumber);
  const basKey = normalizePartNumber(input.basCode);
  const matches: DuplicateMatch[] = [];
  for (const candidate of candidates) {
    if (basKey && normalizePartNumber(candidate.basCode) === basKey) {
      matches.push({ ...candidate, score: 1, reason: "bas_code" });
      continue;
    }
    if (partKey && normalizePartNumber(candidate.partNumber) === partKey) {
      matches.push({ ...candidate, score: 1, reason: "part_number" });
      continue;
    }
    const score = similarity(input.name, candidate.name);
    if (score >= threshold) {
      matches.push({ ...candidate, score, reason: "name" });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 10);
}
