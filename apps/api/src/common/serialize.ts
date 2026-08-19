import { toNumber } from "@konfor/shared";

const MONEY_KEYS = new Set([
  "amount",
  "netAmount",
  "vatAmount",
  "grossAmount",
  "expectedAmount",
]);

export function serializeRecord<T>(row: T): T {
  if (row == null || typeof row !== "object") return row;
  if (Array.isArray(row)) {
    return row.map((item) => serializeRecord(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as object)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (
      MONEY_KEYS.has(key) ||
      (value && typeof value === "object" && typeof (value as { toNumber?: () => number }).toNumber === "function")
    ) {
      out[key] = toNumber(value as never);
    } else if (value && typeof value === "object") {
      out[key] = serializeRecord(value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function serializeMany<T>(rows: T[]): T[] {
  return rows.map((row) => serializeRecord(row));
}
