import "server-only";
import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { accounts, ledgerEntries, vouchers } from "@/db/schema";
import { d, m2, type Num } from "@/lib/calc";
import { assertDayOpen, audit, getFy, nextNumber, type Actor } from "./core";
import { fail } from "./errors";

export interface PostLine {
  accountId: number;
  /** Signed: positive = debit (naam). Negative debit becomes a credit. */
  debit?: Num;
  /** Signed: positive = credit (jama). Negative credit becomes a debit. */
  credit?: Num;
  narration?: string;
}

export interface VoucherInput {
  type: string;
  date: string;
  narration?: string;
  mode?: string;
  refNo?: string;
  bankAccountId?: number | null;
  partyId?: number | null;
  amount?: Num;
  docType?: string | null;
  docId?: number | null;
  reversesId?: number | null;
  lines: PostLine[];
}

/** Collapse signed lines into one debit or credit per (account, side). */
export function normaliseLines(lines: PostLine[]) {
  const out: { accountId: number; debit: string; credit: string; narration: string }[] = [];
  for (const l of lines) {
    const net = d(l.debit).minus(d(l.credit));
    if (net.isZero()) continue;
    out.push({
      accountId: l.accountId,
      debit: net.gt(0) ? m2(net) : "0.00",
      credit: net.isNegative() ? m2(net.abs()) : "0.00",
      narration: l.narration ?? "",
    });
  }
  return out;
}

/**
 * Create one voucher and its ledger lines. Must run inside a transaction.
 * Debits must equal credits (checked here and again by the DB trigger).
 */
export async function postVoucher(tx: DbOrTx, actor: Actor | null, v: VoucherInput) {
  await assertDayOpen(tx, v.date);
  const fy = await getFy(tx, v.date);
  const lines = normaliseLines(v.lines);
  if (lines.length < 2) fail("एंट्री में कम से कम दो खाते होने चाहिए", "An entry needs at least two accounts");
  const dr = lines.reduce((a, l) => a.plus(l.debit), d(0));
  const cr = lines.reduce((a, l) => a.plus(l.credit), d(0));
  if (!dr.equals(cr)) {
    fail(`जमा-नाम बराबर नहीं (${dr} / ${cr})`, `Debit and credit do not match (${dr} / ${cr})`);
  }
  const voucherNo = await nextNumber(tx, `v_${v.type}`, fy.id);
  const [row] = await tx
    .insert(vouchers)
    .values({
      type: v.type,
      voucherNo,
      fyId: fy.id,
      date: v.date,
      narration: v.narration ?? "",
      mode: v.mode ?? "journal",
      refNo: v.refNo ?? "",
      bankAccountId: v.bankAccountId ?? null,
      partyId: v.partyId ?? null,
      amount: m2(v.amount ?? dr),
      docType: v.docType ?? null,
      docId: v.docId ?? null,
      reversesId: v.reversesId ?? null,
      createdBy: actor?.id ?? null,
    })
    .returning();
  await tx.insert(ledgerEntries).values(lines.map((l) => ({ ...l, voucherId: row.id, date: v.date })));
  return row;
}

/**
 * Cancel a voucher: mark it radd and post a mirror-image reversal on the same
 * date (so the day's books stay right). Ledger rows are never edited.
 */
export async function reverseVoucher(tx: DbOrTx, actor: Actor, voucherId: number, reason: string) {
  const [orig] = await tx.select().from(vouchers).where(eq(vouchers.id, voucherId)).for("update");
  if (!orig) fail("वाउचर नहीं मिला", "Voucher not found");
  if (orig.status === "radd") fail("यह पहले ही रद्द है", "This is already cancelled");
  const lines = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.voucherId, voucherId));
  const rev = await postVoucher(tx, actor, {
    type: "reversal",
    date: orig.date,
    narration: `रद्द / Reversal of ${orig.type} #${orig.voucherNo}: ${reason}`,
    mode: orig.mode,
    refNo: orig.refNo,
    bankAccountId: orig.bankAccountId,
    partyId: orig.partyId,
    amount: orig.amount,
    docType: orig.docType,
    docId: orig.docId,
    reversesId: orig.id,
    lines: lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, narration: l.narration })),
  });
  await tx.update(vouchers).set({ status: "radd" }).where(eq(vouchers.id, voucherId));
  await audit(tx, actor, { table: "vouchers", rowId: voucherId, action: "radd", oldData: orig, newData: { reversalId: rev.id }, reason });
  return rev;
}

/* ----------------------------------------------------------- balances */

/** Signed opening balance from the party master (naam +). */
export function openingSigned(a: { openingAmount: string; openingSide: string }) {
  const x = d(a.openingAmount);
  return a.openingSide === "naam" ? x : x.negated();
}

/** SQL fragment excluding voucher types (and reversals of them). Needs aliases v and o. */
function excludeSql(types: string[] | undefined) {
  if (!types?.length) return sql`TRUE`;
  const list = sql.join(types.map((t) => sql`${t}`), sql`, `);
  return sql`NOT (v.type IN (${list}) OR (v.type = 'reversal' AND o.type IN (${list})))`;
}

/** Signed balance (naam +) including the opening, up to `asOf` (inclusive) or before `before`. */
export async function balanceOf(
  tx: DbOrTx,
  accountId: number,
  opts: { asOf?: string; before?: string; excludeTypes?: string[] } = {},
) {
  const [acc] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
  if (!acc) return d(0);
  const dateCond = opts.asOf
    ? sql`le.date <= ${opts.asOf}`
    : opts.before
      ? sql`le.date < ${opts.before}`
      : sql`TRUE`;
  const rows = await tx.execute<{ bal: string }>(sql`
    SELECT COALESCE(SUM(le.debit - le.credit), 0) AS bal
    FROM ledger_entries le
    JOIN vouchers v ON v.id = le.voucher_id
    LEFT JOIN vouchers o ON o.id = v.reverses_id
    WHERE le.account_id = ${accountId} AND ${dateCond} AND ${excludeSql(opts.excludeTypes)}`);
  return openingSigned(acc).plus(d(rows[0]?.bal ?? 0));
}

/** Ledger movements of an account in a date range (inclusive). */
export async function movements(
  tx: DbOrTx,
  accountId: number,
  from: string,
  to: string,
  opts: { excludeTypes?: string[] } = {},
) {
  const rows = await tx.execute<{ date: string; debit: string; credit: string; type: string; orig_type: string | null }>(sql`
    SELECT le.date::text AS date, le.debit, le.credit, v.type, o.type AS orig_type
    FROM ledger_entries le
    JOIN vouchers v ON v.id = le.voucher_id
    LEFT JOIN vouchers o ON o.id = v.reverses_id
    WHERE le.account_id = ${accountId} AND le.date >= ${from} AND le.date <= ${to}
    ORDER BY le.date, le.id`);
  const ex = opts.excludeTypes ?? [];
  return rows
    .filter((r) => !ex.includes(r.type) && !(r.type === "reversal" && r.orig_type && ex.includes(r.orig_type)))
    .map((r) => ({ date: r.date, debit: r.debit, credit: r.credit }));
}

