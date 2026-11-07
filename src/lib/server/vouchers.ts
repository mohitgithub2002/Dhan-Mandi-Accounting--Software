import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { billAllocations, interestRules, tdsEntries, vouchers } from "@/db/schema";
import { d, formatINR, m2, type Num } from "@/lib/calc";
import { tdsQuarter } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { audit, getAccount, getFirm, getFy, systemAccount, type Actor } from "./core";
import { fail } from "./errors";
import { postVoucher, reverseVoucher } from "./ledger";

export type PayMode = "cash" | "cheque" | "neft" | "upi";
export const PAY_MODES: PayMode[] = ["cash", "cheque", "neft", "upi"];

/** Cash or the chosen bank account. */
async function moneyAccount(tx: DbOrTx, mode: PayMode, bankAccountId?: number | null) {
  if (mode === "cash") return systemAccount(tx, "CASH");
  if (!bankAccountId) fail("बैंक खाता चुनें", "Choose the bank account");
  const b = await getAccount(tx, bankAccountId as number);
  if (b.partyType !== "bank") fail("बैंक खाता चुनें", "Choose the bank account");
  return b.id;
}

function requireAmount(v: Num) {
  if (!d(v).gt(0)) fail("रकम डालें", "Enter the amount");
}

/** Warning (not a block) for cash above the firm's limit (PRD §5.7). */
async function cashWarnings(tx: DbOrTx, mode: PayMode, amount: Num) {
  if (mode !== "cash") return [];
  const firm = await getFirm(tx);
  if (d(firm.cashLimit).gt(0) && d(amount).greaterThan(d(firm.cashLimit))) {
    return [`नकद ₹${formatINR(amount)} सीमा ₹${formatINR(firm.cashLimit)} से ज़्यादा है / Cash above limit`];
  }
  return [];
}

/** Open bills of a vyapari with the balance still unallocated, oldest first. */
export async function openBills(tx: DbOrTx, vyapariId: number) {
  const rows = await tx.execute<{ id: number; bill_no: number; date: string; due_date: string | null; total: string; allocated: string }>(sql`
    SELECT b.id, b.bill_no, b.date::text AS date, b.due_date::text AS due_date, b.total,
      COALESCE((SELECT SUM(a.amount) FROM bill_allocations a WHERE a.bill_id = b.id), 0) AS allocated
    FROM bills b
    WHERE b.vyapari_id = ${vyapariId} AND b.status = 'active'
    ORDER BY b.date, b.bill_no`);
  return rows
    .map((r) => ({
      id: Number(r.id),
      billNo: Number(r.bill_no),
      date: r.date,
      dueDate: r.due_date,
      total: r.total,
      pending: m2(d(r.total).minus(d(r.allocated))),
    }))
    .filter((r) => d(r.pending).gt(0));
}

export interface ReceiptInput {
  date: string;
  partyId: number;
  amount: Num;
  mode: PayMode;
  bankAccountId?: number | null;
  refNo?: string;
  narration?: string;
  tds194Q?: Num;
  tds194H?: Num;
  /** "auto" = oldest first; or explicit bill allocations. */
  allocation?: "auto" | { billId: number; amount: Num }[];
}

/** Jama: money received (usually from a vyapari), with TDS he deducted recorded separately. */
export async function createReceipt(tx: DbOrTx, actor: Actor, r: ReceiptInput) {
  if (!can(actor.role, "jama_naam")) fail("जमा-नाम की अनुमति नहीं", "You cannot enter receipts");
  requireAmount(r.amount);
  const party = await getAccount(tx, r.partyId);
  const tdsQ = d(r.tds194Q);
  const tdsH = d(r.tds194H);
  if (tdsQ.isNegative() || tdsH.isNegative()) fail("TDS ग़लत है", "TDS cannot be negative");
  const tds = tdsQ.plus(tdsH);
  const cashOrBank = await moneyAccount(tx, r.mode, r.bankAccountId);
  const tdsAcc = await systemAccount(tx, "TDS_RECV");
  const credit = d(r.amount).plus(tds);
  const v = await postVoucher(tx, actor, {
    type: "jama",
    date: r.date,
    narration: r.narration || `जमा / Receipt from ${party.nameEn || party.nameHi}`,
    mode: r.mode,
    refNo: r.refNo ?? "",
    bankAccountId: r.mode === "cash" ? null : cashOrBank,
    partyId: party.id,
    amount: r.amount,
    lines: [
      { accountId: cashOrBank, debit: r.amount },
      { accountId: tdsAcc, debit: tds, narration: "TDS" },
      { accountId: party.id, credit },
    ],
  });

  if (!tds.isZero()) {
    const fy = await getFy(tx, r.date);
    const quarter = tdsQuarter(r.date);
    const rows = [
      { section: "194Q", amount: tdsQ },
      { section: "194H", amount: tdsH },
    ].filter((x) => x.amount.gt(0));
    await tx.insert(tdsEntries).values(
      rows.map((x) => ({ voucherId: v.id, vyapariId: party.id, section: x.section, amount: m2(x.amount), quarter, fyId: fy.id })),
    );
  }

  // Bill allocation (which receipt settled which bill).
  if (party.partyType === "vyapari" || party.partyType === "agency") {
    const open = await openBills(tx, party.id);
    let allocs: { billId: number; amount: string }[] = [];
    if (!r.allocation || r.allocation === "auto") {
      let left = credit;
      for (const b of open) {
        if (!left.gt(0)) break;
        const take = d(b.pending).lessThan(left) ? d(b.pending) : left;
        allocs.push({ billId: b.id, amount: m2(take) });
        left = left.minus(take);
      }
    } else {
      const total = r.allocation.reduce((a, x) => a.plus(d(x.amount)), d(0));
      if (total.greaterThan(credit)) fail("मिलान की रकम जमा से ज़्यादा है", "Allocated amount is more than received");
      for (const a of r.allocation) {
        const b = open.find((o) => o.id === a.billId);
        if (!b) fail("बिल बकाया नहीं है", "That bill has nothing pending");
        if (d(a.amount).greaterThan(d(b!.pending))) fail(`बिल ${b!.billNo} में बकाया कम है`, `Bill ${b!.billNo} has less pending`);
      }
      allocs = r.allocation.filter((a) => d(a.amount).gt(0)).map((a) => ({ billId: a.billId, amount: m2(a.amount) }));
    }
    if (allocs.length) await tx.insert(billAllocations).values(allocs.map((a) => ({ ...a, receiptVoucherId: v.id })));
  }
  await audit(tx, actor, { table: "vouchers", rowId: v.id, action: "create", newData: r });
  return { voucher: v, warnings: await cashWarnings(tx, r.mode, r.amount) };
}

export interface PaymentInput {
  date: string;
  kind: "naam" | "peshgi" | "kharcha";
  /** Party (naam/peshgi) or expense / payable account (kharcha). */
  accountId: number;
  amount: Num;
  mode: PayMode;
  bankAccountId?: number | null;
  refNo?: string;
  narration?: string;
  /** Peshgi only: byaj % per month for a new rule (default from party). */
  byajRatePm?: Num | null;
}

/** Naam: payment to kisan, peshgi (advance), or kharcha payment. */
export async function createPayment(tx: DbOrTx, actor: Actor, p: PaymentInput) {
  if (!can(actor.role, "jama_naam")) fail("जमा-नाम की अनुमति नहीं", "You cannot enter payments");
  requireAmount(p.amount);
  const acc = await getAccount(tx, p.accountId);
  if (p.kind === "peshgi" && acc.partyType !== "kisan") fail("पेशगी केवल किसान को", "Peshgi is only for a kisan");
  const cashOrBank = await moneyAccount(tx, p.mode, p.bankAccountId);
  const label = p.kind === "peshgi" ? "पेशगी / Peshgi" : p.kind === "kharcha" ? "खर्चा / Kharcha" : "भुगतान / Payment";
  const v = await postVoucher(tx, actor, {
    type: p.kind,
    date: p.date,
    narration: p.narration || `${label} — ${acc.nameEn || acc.nameHi}`,
    mode: p.mode,
    refNo: p.refNo ?? "",
    bankAccountId: p.mode === "cash" ? null : cashOrBank,
    partyId: acc.id,
    amount: p.amount,
    lines: [
      { accountId: acc.id, debit: p.amount },
      { accountId: cashOrBank, credit: p.amount },
    ],
  });
  if (p.kind === "peshgi" && p.byajRatePm !== undefined && p.byajRatePm !== null && d(p.byajRatePm).gt(0)) {
    const [rule] = await tx
      .select()
      .from(interestRules)
      .where(and(eq(interestRules.accountId, acc.id), eq(interestRules.active, true)))
      .orderBy(asc(interestRules.effectiveFrom));
    if (!rule || !d(rule.ratePm).equals(d(p.byajRatePm))) {
      await tx.insert(interestRules).values({ accountId: acc.id, ratePm: d(p.byajRatePm).toFixed(4), method: "simple", effectiveFrom: p.date });
    }
  }
  await audit(tx, actor, { table: "vouchers", rowId: v.id, action: "create", newData: p });
  return { voucher: v, warnings: await cashWarnings(tx, p.mode, p.amount) };
}

export interface ContraInput {
  date: string;
  fromAccountId: number; // cash or bank
  toAccountId: number;
  amount: Num;
  refNo?: string;
  narration?: string;
}

/** Contra: cash ⇄ bank, bank ⇄ bank. */
export async function createContra(tx: DbOrTx, actor: Actor, c: ContraInput) {
  if (!can(actor.role, "jama_naam")) fail("जमा-नाम की अनुमति नहीं", "You cannot enter contra");
  requireAmount(c.amount);
  if (c.fromAccountId === c.toAccountId) fail("दोनों खाते अलग चुनें", "Choose two different accounts");
  const cash = await systemAccount(tx, "CASH");
  for (const id of [c.fromAccountId, c.toAccountId]) {
    const a = await getAccount(tx, id);
    if (a.id !== cash && a.partyType !== "bank") fail("केवल रोकड़ या बैंक", "Only cash or bank accounts");
  }
  const v = await postVoucher(tx, actor, {
    type: "contra",
    date: c.date,
    narration: c.narration || "कॉन्ट्रा / Contra",
    mode: "journal",
    refNo: c.refNo ?? "",
    amount: c.amount,
    lines: [
      { accountId: c.toAccountId, debit: c.amount },
      { accountId: c.fromAccountId, credit: c.amount },
    ],
  });
  await audit(tx, actor, { table: "vouchers", rowId: v.id, action: "create", newData: c });
  return { voucher: v, warnings: [] as string[] };
}

/** Radd of a jama / naam / contra voucher (malik only). Parchi and bill use their own radd. */
export async function raddVoucher(tx: DbOrTx, actor: Actor, id: number, reason: string) {
  if (!can(actor.role, "radd")) fail("रद्द केवल मालिक कर सकते हैं", "Only the malik can cancel");
  if (!reason.trim()) fail("रद्द का कारण लिखें", "Write the reason for cancelling");
  const [v] = await tx.select().from(vouchers).where(eq(vouchers.id, id));
  if (!v) fail("वाउचर नहीं मिला", "Voucher not found");
  if (v.docType) fail("पर्ची/बिल को उसकी स्क्रीन से रद्द करें", "Cancel parchi/bill from its own screen");
  if (v.type === "reversal") fail("रिवर्सल रद्द नहीं होता", "A reversal cannot be cancelled");
  await tx.delete(billAllocations).where(eq(billAllocations.receiptVoucherId, id));
  await tx.delete(tdsEntries).where(eq(tdsEntries.voucherId, id));
  return reverseVoucher(tx, actor, id, reason);
}

