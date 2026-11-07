import "server-only";
import { and, asc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  billAllocations,
  billLines,
  bills,
  documentCharges,
  lotSales,
  lots,
  parchiLines,
  parchis,
  vouchers,
} from "@/db/schema";
import {
  billTotals,
  computeCharges,
  d,
  m2,
  parchiTotals,
  shareOf,
  type ChargeLine,
  type Num,
  type SaleLine,
  type Side,
} from "@/lib/calc";
import { addDaysIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { assertDayOpen, audit, getAccount, getFirm, getFy, nextNumber, systemAccount, type Actor } from "./core";
import { fail } from "./errors";
import { postVoucher, reverseVoucher, type PostLine } from "./ledger";
import { rateContext } from "./rates";
import { editSale, refreshLotStatus, type TulaiInput } from "./sales";

type DocType = "parchi" | "bill";

interface SaleRow {
  id: number;
  lotId: number;
  kisanId: number;
  vyapariId: number | null;
  commodityId: number;
  date: string;
  saleType: string;
  bags: number;
  netKg: string;
  bhav: string | null;
  amount: string;
  parchiId: number | null;
  billId: number | null;
}

async function loadSales(tx: DbOrTx, where: ReturnType<typeof and>) {
  return (await tx
    .select({
      id: lotSales.id,
      lotId: lotSales.lotId,
      kisanId: lots.kisanId,
      vyapariId: lotSales.vyapariId,
      commodityId: lots.commodityId,
      date: lots.date,
      saleType: lotSales.saleType,
      bags: lotSales.bags,
      netKg: lotSales.netKg,
      bhav: lotSales.bhav,
      amount: lotSales.amount,
      parchiId: lotSales.parchiId,
      billId: lotSales.billId,
    })
    .from(lotSales)
    .innerJoin(lots, eq(lots.id, lotSales.lotId))
    .where(where)
    .orderBy(asc(lots.id), asc(lotSales.id))) as SaleRow[];
}

/** Sales ready for a document: boli + tulai done and not yet on that document type. */
export async function pendingSales(
  tx: DbOrTx,
  docType: DocType,
  f: { date?: string; partyId?: number; saleIds?: number[]; lotIds?: number[] },
) {
  const conds = [
    isNotNull(lotSales.vyapariId),
    isNotNull(lotSales.bhav),
    sql`${lotSales.netKg} > 0`,
    docType === "parchi" ? isNull(lotSales.parchiId) : isNull(lotSales.billId),
  ];
  if (f.date) conds.push(eq(lots.date, f.date));
  if (f.partyId) conds.push(docType === "parchi" ? eq(lots.kisanId, f.partyId) : eq(lotSales.vyapariId, f.partyId));
  if (f.saleIds?.length) conds.push(inArray(lotSales.id, f.saleIds));
  if (f.lotIds?.length) conds.push(inArray(lotSales.lotId, f.lotIds));
  return loadSales(tx, and(...conds));
}

const toLines = (sales: SaleRow[]): SaleLine[] =>
  sales.map((s) => ({ commodityId: s.commodityId, netKg: s.netKg, bags: s.bags, amount: s.amount }));

/** Group pending sales into documents per firm setting (per day or per dheri). */
function groupSales(sales: SaleRow[], docType: DocType, mode: string) {
  const groups = new Map<string, SaleRow[]>();
  for (const s of sales) {
    const party = docType === "parchi" ? s.kisanId : s.vyapariId;
    const key = mode === "per_dheri" ? `${s.lotId}|${party}|${s.saleType}` : `${s.date}|${party}|${s.saleType}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()];
}

/** Ledger lines for one side's charges: each posted share credited to its account. */
async function chargeCredits(tx: DbOrTx, charges: ChargeLine[], side: Side): Promise<PostLine[]> {
  const out: PostLine[] = [];
  for (const c of charges) {
    if (c.postMode === "show") continue;
    const amt = shareOf(c, side);
    if (amt.isZero()) continue;
    const acc =
      c.postAccountId ?? (await systemAccount(tx, c.postMode === "payable" ? "MANDI_SAMITI" : "ARHAT_INCOME"));
    out.push({ accountId: acc, credit: amt, narration: c.nameEn });
  }
  return out;
}

async function saveDocCharges(tx: DbOrTx, docType: DocType, docId: number, charges: ChargeLine[], side: Side) {
  await tx.delete(documentCharges).where(and(eq(documentCharges.docType, docType), eq(documentCharges.docId, docId)));
  if (!charges.length) return;
  await tx.insert(documentCharges).values(
    charges.map((c) => ({
      docType,
      docId,
      chargeHeadId: c.headId,
      code: c.code,
      nameHi: c.nameHi,
      nameEn: c.nameEn,
      basis: c.basis,
      basisValue: c.basisValue,
      rateUsed: c.rateUsed,
      fullAmount: c.fullAmount,
      amount: m2(shareOf(c, side)),
      payer: c.payer,
      postMode: c.postMode,
      postAccountId: c.postAccountId,
      printed: side === "kisan" ? c.onParchi : c.onBill,
      seq: c.seq,
    })),
  );
}

/* ================================================================ parchi */

async function computeParchi(tx: DbOrTx, date: string, kisanId: number, saleType: string, sales: SaleRow[], peshgi: Num) {
  const firm = await getFirm(tx);
  const { heads, rates } = await rateContext(tx, date, saleType, kisanId);
  const lines = toLines(sales);
  const charges = computeCharges(heads, rates, lines);
  const totals = parchiTotals(lines, charges, firm.totalRounding, peshgi);
  const excludeRakam = saleType === "sarkari" && !firm.sarkariCreditKisan;
  return { firm, totals, excludeRakam };
}

async function postParchiVoucher(
  tx: DbOrTx,
  actor: Actor,
  p: { id: number; parchiNo: number; date: string; kisanId: number },
  t: Awaited<ReturnType<typeof computeParchi>>,
) {
  const clearing = await systemAccount(tx, "SALE_CLEARING");
  const roundOffAcc = await systemAccount(tx, "ROUND_OFF");
  const credits = await chargeCredits(tx, t.totals.charges, "kisan");
  let lines: PostLine[];
  if (t.excludeRakam) {
    // Govt pays the kisan directly: only his kharcha is charged to his khata.
    const ded = d(t.totals.deductions);
    lines = [{ accountId: p.kisanId, debit: ded }, ...credits];
  } else {
    lines = [
      { accountId: clearing, debit: t.totals.gross, narration: "Sale value" },
      { accountId: p.kisanId, credit: t.totals.net, narration: `Parchi ${p.parchiNo}` },
      ...credits,
      { accountId: roundOffAcc, debit: t.totals.roundOff, narration: "Round off" },
    ];
  }
  return postVoucher(tx, actor, {
    type: "parchi",
    date: p.date,
    narration: `किसान पर्ची / Kisan parchi ${p.parchiNo}`,
    partyId: p.kisanId,
    amount: t.excludeRakam ? t.totals.deductions : t.totals.net,
    docType: "parchi",
    docId: p.id,
    lines,
  });
}

async function writeParchiLines(tx: DbOrTx, parchiId: number, sales: SaleRow[]) {
  await tx.delete(parchiLines).where(eq(parchiLines.parchiId, parchiId));
  await tx.insert(parchiLines).values(
    sales.map((s) => ({
      parchiId,
      lotSaleId: s.id,
      commodityId: s.commodityId,
      vyapariId: s.vyapariId,
      bags: s.bags,
      netKg: s.netKg,
      bhav: s.bhav ?? "0",
      amount: s.amount,
    })),
  );
}

export async function createParchi(
  tx: DbOrTx,
  actor: Actor,
  input: { kisanId: number; saleType: string; date: string; sales: SaleRow[]; peshgiRecovered?: Num },
) {
  await assertDayOpen(tx, input.date);
  const fy = await getFy(tx, input.date);
  const t = await computeParchi(tx, input.date, input.kisanId, input.saleType, input.sales, input.peshgiRecovered ?? 0);
  const parchiNo = await nextNumber(tx, "parchi", fy.id);
  const [p] = await tx
    .insert(parchis)
    .values({
      parchiNo,
      fyId: fy.id,
      date: input.date,
      kisanId: input.kisanId,
      saleType: input.saleType,
      grossAmount: t.totals.gross,
      deductions: t.totals.deductions,
      roundOff: t.totals.roundOff,
      netAmount: t.totals.net,
      peshgiRecovered: t.totals.peshgiRecovered,
      payableAmount: t.totals.payable,
      createdBy: actor.id,
    })
    .returning();
  await writeParchiLines(tx, p.id, input.sales);
  await saveDocCharges(tx, "parchi", p.id, t.totals.charges, "kisan");
  const v = await postParchiVoucher(tx, actor, p, t);
  await tx.update(parchis).set({ voucherId: v.id }).where(eq(parchis.id, p.id));
  await tx.update(lotSales).set({ parchiId: p.id }).where(inArray(lotSales.id, input.sales.map((s) => s.id)));
  for (const lotId of new Set(input.sales.map((s) => s.lotId))) await refreshLotStatus(tx, lotId);
  await audit(tx, actor, { table: "parchis", rowId: p.id, action: "create", newData: { parchiNo, totals: t.totals } });
  return { ...p, voucherId: v.id };
}

/** Make parchis for all pending sales matching the filter, grouped per firm setting. */
export async function makeParchis(
  tx: DbOrTx,
  actor: Actor,
  f: { date?: string; kisanId?: number; saleIds?: number[]; lotIds?: number[]; peshgiRecovered?: Num },
) {
  const firm = await getFirm(tx);
  const sales = await pendingSales(tx, "parchi", { date: f.date, partyId: f.kisanId, saleIds: f.saleIds, lotIds: f.lotIds });
  const groups = groupSales(sales, "parchi", firm.parchiMode);
  const made = [];
  for (const g of groups) {
    made.push(
      await createParchi(tx, actor, {
        kisanId: g[0].kisanId,
        saleType: g[0].saleType,
        date: g[0].date,
        sales: g,
        peshgiRecovered: groups.length === 1 ? f.peshgiRecovered : 0,
      }),
    );
  }
  return made;
}

async function lockParchi(tx: DbOrTx, id: number) {
  const [p] = await tx.select().from(parchis).where(eq(parchis.id, id)).for("update");
  if (!p) fail("पर्ची नहीं मिली", "Parchi not found");
  return p;
}

/** Radd: keeps the number, reverses the posting, frees the dheris for a new parchi. */
export async function raddParchi(tx: DbOrTx, actor: Actor, id: number, reason: string) {
  if (!can(actor.role, "radd")) fail("रद्द केवल मालिक कर सकते हैं", "Only the malik can cancel");
  if (!reason.trim()) fail("रद्द का कारण लिखें", "Write the reason for cancelling");
  const p = await lockParchi(tx, id);
  if (p.status === "radd") fail("यह पर्ची पहले ही रद्द है", "This parchi is already cancelled");
  await assertDayOpen(tx, p.date);
  if (p.voucherId) await reverseVoucher(tx, actor, p.voucherId, reason);
  await tx
    .update(parchis)
    .set({ status: "radd", raddReason: reason, raddBy: actor.id, raddAt: new Date() })
    .where(eq(parchis.id, id));
  const sales = await tx.select().from(lotSales).where(eq(lotSales.parchiId, id));
  await tx.update(lotSales).set({ parchiId: null }).where(eq(lotSales.parchiId, id));
  for (const lotId of new Set(sales.map((s) => s.lotId))) await refreshLotStatus(tx, lotId);
  await audit(tx, actor, { table: "parchis", rowId: id, action: "radd", oldData: p, reason });
}

/** Re-post a parchi after its sales changed: reverse old voucher, recompute, post again (same number). */
export async function repostParchi(tx: DbOrTx, actor: Actor, id: number, reason: string, peshgi?: Num) {
  const p = await lockParchi(tx, id);
  if (p.status === "radd") fail("रद्द पर्ची नहीं बदल सकते", "A cancelled parchi cannot be edited");
  await assertDayOpen(tx, p.date);
  const sales = await loadSales(tx, and(eq(lotSales.parchiId, id)));
  const t = await computeParchi(tx, p.date, p.kisanId, p.saleType, sales, peshgi ?? p.peshgiRecovered);
  if (p.voucherId) await reverseVoucher(tx, actor, p.voucherId, `Edit: ${reason}`);
  await writeParchiLines(tx, id, sales);
  await saveDocCharges(tx, "parchi", id, t.totals.charges, "kisan");
  const v = await postParchiVoucher(tx, actor, p, t);
  const next = {
    grossAmount: t.totals.gross,
    deductions: t.totals.deductions,
    roundOff: t.totals.roundOff,
    netAmount: t.totals.net,
    peshgiRecovered: t.totals.peshgiRecovered,
    payableAmount: t.totals.payable,
    voucherId: v.id,
  };
  await tx.update(parchis).set(next).where(eq(parchis.id, id));
  await audit(tx, actor, { table: "parchis", rowId: id, action: "edit", oldData: p, newData: next, reason });
}

/** Peshgi recovered is printed netting only (both sit in the kisan khata), so no re-posting. */
export async function setParchiPeshgi(tx: DbOrTx, actor: Actor, id: number, amount: Num, reason: string) {
  const p = await lockParchi(tx, id);
  if (p.status === "radd") fail("रद्द पर्ची नहीं बदल सकते", "A cancelled parchi cannot be edited");
  await assertDayOpen(tx, p.date);
  if (p.printCount > 0) {
    if (!can(actor.role, "edit_printed")) fail("छपी पर्ची केवल मालिक या मुनीम बदल सकते हैं", "Only malik or munim can edit a printed parchi");
    if (!reason.trim()) fail("बदलाव का कारण लिखें", "Write the reason for the change");
  }
  const amt = d(amount);
  if (amt.isNegative() || amt.greaterThan(d(p.netAmount))) fail("पेशगी वसूली नेट से ज़्यादा नहीं हो सकती", "Peshgi recovered cannot exceed the net amount");
  const next = { peshgiRecovered: m2(amt), payableAmount: m2(d(p.netAmount).minus(amt)) };
  await tx.update(parchis).set(next).where(eq(parchis.id, id));
  await audit(tx, actor, { table: "parchis", rowId: id, action: "edit", oldData: { peshgiRecovered: p.peshgiRecovered }, newData: next, reason });
}

/* ================================================================== bill */

async function computeBill(tx: DbOrTx, date: string, vyapariId: number, saleType: string, sales: SaleRow[]) {
  const firm = await getFirm(tx);
  const { heads, rates } = await rateContext(tx, date, saleType, vyapariId);
  const lines = toLines(sales);
  const charges = computeCharges(heads, rates, lines);
  const totals = billTotals(lines, charges, firm.totalRounding);
  const excludeRakam = saleType === "sarkari" && !firm.sarkariCreditKisan;
  return { firm, totals, excludeRakam };
}

async function postBillVoucher(
  tx: DbOrTx,
  actor: Actor,
  b: { id: number; billNo: number; date: string; vyapariId: number },
  t: Awaited<ReturnType<typeof computeBill>>,
) {
  const clearing = await systemAccount(tx, "SALE_CLEARING");
  const roundOffAcc = await systemAccount(tx, "ROUND_OFF");
  const credits = await chargeCredits(tx, t.totals.lines, "vyapari");
  const total = t.excludeRakam ? d(t.totals.charges) : d(t.totals.total);
  const lines: PostLine[] = t.excludeRakam
    ? [{ accountId: b.vyapariId, debit: total, narration: `Bill ${b.billNo}` }, ...credits]
    : [
        { accountId: b.vyapariId, debit: total, narration: `Bill ${b.billNo}` },
        { accountId: clearing, credit: t.totals.amount, narration: "Sale value" },
        ...credits,
        { accountId: roundOffAcc, credit: t.totals.roundOff, narration: "Round off" },
      ];
  return postVoucher(tx, actor, {
    type: "bill",
    date: b.date,
    narration: `व्यापारी बिल / Vyapari bill ${b.billNo}`,
    partyId: b.vyapariId,
    amount: total,
    docType: "bill",
    docId: b.id,
    lines,
  });
}

async function writeBillLines(tx: DbOrTx, billId: number, sales: SaleRow[]) {
  await tx.delete(billLines).where(eq(billLines.billId, billId));
  await tx.insert(billLines).values(
    sales.map((s) => ({
      billId,
      lotSaleId: s.id,
      commodityId: s.commodityId,
      kisanId: s.kisanId,
      bags: s.bags,
      netKg: s.netKg,
      bhav: s.bhav ?? "0",
      amount: s.amount,
    })),
  );
}

/** Stored bill total = what the vyapari owes (charges only for sarkari without kisan credit). */
const billTotalFor = (t: Awaited<ReturnType<typeof computeBill>>) => (t.excludeRakam ? t.totals.charges : t.totals.total);

export async function createBill(
  tx: DbOrTx,
  actor: Actor,
  input: { vyapariId: number; saleType: string; date: string; sales: SaleRow[] },
) {
  await assertDayOpen(tx, input.date);
  const fy = await getFy(tx, input.date);
  const vyapari = await getAccount(tx, input.vyapariId);
  const t = await computeBill(tx, input.date, input.vyapariId, input.saleType, input.sales);
  const billNo = await nextNumber(tx, "bill", fy.id);
  const [b] = await tx
    .insert(bills)
    .values({
      billNo,
      fyId: fy.id,
      date: input.date,
      vyapariId: input.vyapariId,
      saleType: input.saleType,
      amount: t.totals.amount,
      charges: t.totals.charges,
      roundOff: t.excludeRakam ? "0" : t.totals.roundOff,
      total: billTotalFor(t),
      dueDate: addDaysIso(input.date, vyapari.creditDays || 0),
      createdBy: actor.id,
    })
    .returning();
  await writeBillLines(tx, b.id, input.sales);
  await saveDocCharges(tx, "bill", b.id, t.totals.lines, "vyapari");
  const v = await postBillVoucher(tx, actor, b, t);
  await tx.update(bills).set({ voucherId: v.id }).where(eq(bills.id, b.id));
  await tx.update(lotSales).set({ billId: b.id }).where(inArray(lotSales.id, input.sales.map((s) => s.id)));
  await audit(tx, actor, { table: "bills", rowId: b.id, action: "create", newData: { billNo, totals: t.totals } });
  return { ...b, voucherId: v.id };
}

export async function makeBills(
  tx: DbOrTx,
  actor: Actor,
  f: { date?: string; vyapariId?: number; saleIds?: number[]; lotIds?: number[] },
) {
  const firm = await getFirm(tx);
  const sales = await pendingSales(tx, "bill", { date: f.date, partyId: f.vyapariId, saleIds: f.saleIds, lotIds: f.lotIds });
  const made = [];
  for (const g of groupSales(sales, "bill", firm.billMode)) {
    made.push(
      await createBill(tx, actor, { vyapariId: g[0].vyapariId as number, saleType: g[0].saleType, date: g[0].date, sales: g }),
    );
  }
  return made;
}

async function lockBill(tx: DbOrTx, id: number) {
  const [b] = await tx.select().from(bills).where(eq(bills.id, id)).for("update");
  if (!b) fail("बिल नहीं मिला", "Bill not found");
  return b;
}

export async function raddBill(tx: DbOrTx, actor: Actor, id: number, reason: string) {
  if (!can(actor.role, "radd")) fail("रद्द केवल मालिक कर सकते हैं", "Only the malik can cancel");
  if (!reason.trim()) fail("रद्द का कारण लिखें", "Write the reason for cancelling");
  const b = await lockBill(tx, id);
  if (b.status === "radd") fail("यह बिल पहले ही रद्द है", "This bill is already cancelled");
  await assertDayOpen(tx, b.date);
  const allocs = await tx.select().from(billAllocations).where(eq(billAllocations.billId, id));
  if (allocs.length) {
    await tx.delete(billAllocations).where(eq(billAllocations.billId, id));
  }
  if (b.voucherId) await reverseVoucher(tx, actor, b.voucherId, reason);
  await tx.update(bills).set({ status: "radd", raddReason: reason, raddBy: actor.id, raddAt: new Date() }).where(eq(bills.id, id));
  await tx.update(lotSales).set({ billId: null }).where(eq(lotSales.billId, id));
  await audit(tx, actor, { table: "bills", rowId: id, action: "radd", oldData: { bill: b, allocations: allocs }, reason });
}

export async function repostBill(tx: DbOrTx, actor: Actor, id: number, reason: string) {
  const b = await lockBill(tx, id);
  if (b.status === "radd") fail("रद्द बिल नहीं बदल सकते", "A cancelled bill cannot be edited");
  await assertDayOpen(tx, b.date);
  const sales = await loadSales(tx, and(eq(lotSales.billId, id)));
  const t = await computeBill(tx, b.date, b.vyapariId, b.saleType, sales);
  if (b.voucherId) await reverseVoucher(tx, actor, b.voucherId, `Edit: ${reason}`);
  await writeBillLines(tx, id, sales);
  await saveDocCharges(tx, "bill", id, t.totals.lines, "vyapari");
  const v = await postBillVoucher(tx, actor, b, t);
  const next = {
    amount: t.totals.amount,
    charges: t.totals.charges,
    roundOff: t.excludeRakam ? "0" : t.totals.roundOff,
    total: billTotalFor(t),
    voucherId: v.id,
  };
  await tx.update(bills).set(next).where(eq(bills.id, id));
  await audit(tx, actor, { table: "bills", rowId: id, action: "edit", oldData: b, newData: next, reason });
}

/* ============================================================ edit sale */

export async function editSaleAndRepost(
  tx: DbOrTx,
  actor: Actor,
  saleId: number,
  change: { bhav?: Num; tulai?: TulaiInput },
  reason: string,
) {
  return editSale(
    tx,
    actor,
    saleId,
    change,
    reason,
    async (docType, id) => (docType === "parchi" ? repostParchi(tx, actor, id, reason) : repostBill(tx, actor, id, reason)),
    async (docType, id) => {
      const [row] =
        docType === "parchi"
          ? await tx.select({ c: parchis.printCount }).from(parchis).where(eq(parchis.id, id))
          : await tx.select({ c: bills.printCount }).from(bills).where(eq(bills.id, id));
      return row?.c ?? 0;
    },
  );
}

/** First print is "Original"; every later print is "Nakal" (PRD §8). */
export async function markPrinted(tx: DbOrTx, actor: Actor, docType: DocType | "voucher", id: number) {
  if (docType === "parchi") await tx.update(parchis).set({ printCount: sql`${parchis.printCount} + 1` }).where(eq(parchis.id, id));
  else if (docType === "bill") await tx.update(bills).set({ printCount: sql`${bills.printCount} + 1` }).where(eq(bills.id, id));
  else await tx.update(vouchers).set({ printCount: sql`${vouchers.printCount} + 1` }).where(eq(vouchers.id, id));
  await audit(tx, actor, { table: docType === "voucher" ? "vouchers" : `${docType}s`, rowId: id, action: "print" });
}
