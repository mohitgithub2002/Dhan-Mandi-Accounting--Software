import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { accounts, auditLog, dayCloses, financialYears, firmSettings } from "@/db/schema";
import { fyFor } from "@/lib/dates";
import type { Role } from "@/lib/permissions";
import { fail } from "./errors";

/** The signed-in user performing a service call. */
export interface Actor {
  id: number;
  role: Role;
  name: string;
  lang: string;
}

export type FirmSettings = typeof firmSettings.$inferSelect;

export async function getFirm(tx: DbOrTx): Promise<FirmSettings> {
  const [f] = await tx.select().from(firmSettings).where(eq(firmSettings.id, 1));
  if (f) return f;
  const [created] = await tx.insert(firmSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await tx.select().from(firmSettings).where(eq(firmSettings.id, 1)))[0];
}

/** Financial year for a date; created on first use. Locked years reject postings. */
export async function getFy(tx: DbOrTx, date: string, { forPosting = true } = {}) {
  const [found] = await tx
    .select()
    .from(financialYears)
    .where(and(lte(financialYears.startDate, date), gte(financialYears.endDate, date)));
  let fy = found;
  if (!fy) {
    const f = fyFor(date);
    await tx
      .insert(financialYears)
      .values({ label: f.label, startDate: f.start, endDate: f.end })
      .onConflictDoNothing();
    [fy] = await tx.select().from(financialYears).where(eq(financialYears.label, f.label));
  }
  if (forPosting && fy.isLocked) {
    fail(`वित्त वर्ष ${fy.label} बंद है। मालिक से खुलवाएं।`, `Financial year ${fy.label} is locked. Ask the malik to unlock it.`);
  }
  return fy;
}

/**
 * Next gapless number for a document type in a financial year. The upsert locks
 * the series row until the surrounding transaction ends, so a rollback returns
 * the number (PRD §10 data rules).
 */
export async function nextNumber(tx: DbOrTx, docType: string, fyId: number): Promise<number> {
  const rows = await tx.execute<{ no: number }>(sql`
    INSERT INTO number_series (doc_type, fy_id, next_no) VALUES (${docType}, ${fyId}, 2)
    ON CONFLICT (doc_type, fy_id) DO UPDATE SET next_no = number_series.next_no + 1
    RETURNING next_no - 1 AS no`);
  return Number(rows[0].no);
}

export async function isDayClosed(tx: DbOrTx, date: string): Promise<boolean> {
  const [row] = await tx.select().from(dayCloses).where(eq(dayCloses.date, date));
  return !!row?.isClosed;
}

/** Din band: nothing may be posted, edited or cancelled on a closed day. */
export async function assertDayOpen(tx: DbOrTx, date: string) {
  if (await isDayClosed(tx, date)) {
    fail(
      `${date.split("-").reverse().join("-")} का दिन बंद है। मालिक से दिन खुलवाएं।`,
      `Day ${date.split("-").reverse().join("-")} is closed. Ask the malik to reopen it.`,
    );
  }
}

export async function audit(
  tx: DbOrTx,
  actor: Actor | null,
  e: { table: string; rowId: string | number; action: string; oldData?: unknown; newData?: unknown; reason?: string | null },
) {
  await tx.insert(auditLog).values({
    tableName: e.table,
    rowId: String(e.rowId),
    action: e.action,
    oldData: (e.oldData ?? null) as object | null,
    newData: (e.newData ?? null) as object | null,
    reason: e.reason ?? null,
    userId: actor?.id ?? null,
  });
}

const systemCache = new Map<string, number>();

/** Id of a seeded system account (CASH, SALE_CLEARING, ARHAT_INCOME, …). */
export async function systemAccount(tx: DbOrTx, code: string): Promise<number> {
  const hit = systemCache.get(code);
  if (hit) return hit;
  const [row] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code));
  if (!row) fail(`सिस्टम खाता ${code} नहीं मिला। सेटअप चलाएं।`, `System account ${code} is missing. Run the database seed.`);
  systemCache.set(code, row.id);
  return row.id;
}

export function clearSystemAccountCache() {
  systemCache.clear();
}

export async function getAccount(tx: DbOrTx, id: number) {
  const [a] = await tx.select().from(accounts).where(eq(accounts.id, id));
  if (!a) fail("खाता नहीं मिला", "Account not found");
  return a;
}

export function partyName(a: { nameHi: string; nameEn: string }, lang: string) {
  return lang === "en" ? a.nameEn || a.nameHi : a.nameHi || a.nameEn;
}
