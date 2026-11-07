import { formatINR } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import type { Column } from "./reports";

/** Display value of a report cell (screen and print). */
export function cellText(col: Column, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (col.type) {
    case "money":
      return formatINR(String(v));
    case "kg":
      return formatINR(Number(v) / 100);
    case "date":
      return formatDate(String(v));
    case "rate":
      return String(Number(v));
    default:
      return String(v);
  }
}

export function totalsOf(cols: Column[], rows: Record<string, unknown>[]) {
  const t: Record<string, number> = {};
  for (const col of cols) if (col.total) t[col.key] = rows.reduce((a, r) => a + (Number(r[col.key]) || 0), 0);
  return t;
}
