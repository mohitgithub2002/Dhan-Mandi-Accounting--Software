/** Dates are ISO strings (YYYY-MM-DD) in India Standard Time. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Financial year (Apr–Mar) containing a date. */
export function fyFor(iso: string): { label: string; start: string; end: string } {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const startYear = m >= 4 ? y : y - 1;
  return {
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

/** 2026-27 Q3 for TDS. */
export function tdsQuarter(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
  return `${fyFor(iso).label} Q${q}`;
}

/** 07-11-2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function addDaysIso(iso: string, n: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
