import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { arrivals, commodities, lotBagWeights, lotSales, lots } from "@/db/schema";
import { bagwiseGross, computeSale, d, m2, type Num } from "@/lib/calc";
import { can } from "@/lib/permissions";
import { assertDayOpen, audit, getAccount, getFy, nextNumber, type Actor } from "./core";
import { fail } from "./errors";
import { rateContext } from "./rates";

export interface ArrivalInput {
  date: string;
  kisanId: number;
  gateEntryNo?: string;
  vehicleNo?: string;
  remarks?: string;
  lots: { commodityId: number; bags: number; qualityNote?: string }[];
}

/** Aamad: one arrival with one or more dheris, each starting with one (unsold) sale line. */
export async function createArrival(tx: DbOrTx, actor: Actor, input: ArrivalInput) {
  await assertDayOpen(tx, input.date);
  if (!input.lots.length) fail("कम से कम एक ढेरी डालें", "Add at least one lot");
  const kisan = await getAccount(tx, input.kisanId);
  if (kisan.partyType !== "kisan") fail("किसान चुनें", "Choose a kisan");
  const fy = await getFy(tx, input.date);
  const arrivalNo = await nextNumber(tx, "aamad", fy.id);
  const [arrival] = await tx
    .insert(arrivals)
    .values({
      arrivalNo,
      fyId: fy.id,
      date: input.date,
      kisanId: input.kisanId,
      gateEntryNo: input.gateEntryNo ?? "",
      vehicleNo: input.vehicleNo ?? "",
      remarks: input.remarks ?? "",
      createdBy: actor.id,
    })
    .returning();

  const lotIds: number[] = [];
  const saleIds: number[] = [];
  for (const l of input.lots) {
    const [c] = await tx.select().from(commodities).where(eq(commodities.id, l.commodityId));
    if (!c) fail("जिंस चुनें", "Choose a commodity");
    const [lot] = await tx
      .insert(lots)
      .values({
        arrivalId: arrival.id,
        kisanId: input.kisanId,
        commodityId: l.commodityId,
        date: input.date,
        bags: l.bags || 0,
        qualityNote: l.qualityNote ?? "",
      })
      .returning();
    const [sale] = await tx
      .insert(lotSales)
      .values({
        lotId: lot.id,
        bags: l.bags || 0,
        weighMode: c.weighMode,
        tarePerBagKg: c.defaultTareKg,
        moisturePct: c.defaultMoisturePct,
      })
      .returning();
    lotIds.push(lot.id);
    saleIds.push(sale.id);
  }
  await audit(tx, actor, { table: "arrivals", rowId: arrival.id, action: "create", newData: input });
  return { arrivalId: arrival.id, arrivalNo, lotIds, saleIds };
}

export async function getLot(tx: DbOrTx, lotId: number) {
  const [lot] = await tx.select().from(lots).where(eq(lots.id, lotId));
  if (!lot) fail("ढेरी नहीं मिली", "Lot not found");
  return lot;
}

export async function refreshLotStatus(tx: DbOrTx, lotId: number) {
  const sales = await tx.select().from(lotSales).where(eq(lotSales.lotId, lotId));
  let status = "aamad";
  if (sales.length && sales.every((s) => s.parchiId)) status = "parchi";
  else if (sales.length && sales.every((s) => s.vyapariId && s.bhav && d(s.netKg).gt(0))) status = "tulai";
  else if (sales.length && sales.every((s) => s.vyapariId && s.bhav)) status = "boli";
  await tx.update(lots).set({ status }).where(eq(lots.id, lotId));
  return status;
}

/** Recompute rakam of a sale from its stored weights and bhav (rates as of the lot date). */
export async function recomputeSale(tx: DbOrTx, saleId: number) {
  const [s] = await tx.select().from(lotSales).where(eq(lotSales.id, saleId));
  const lot = await getLot(tx, s.lotId);
  const { heads, rates } = await rateContext(tx, lot.date, s.saleType, lot.kisanId);
  const r = computeSale(
    {
      commodityId: lot.commodityId,
      grossKg: s.grossKg,
      bags: s.bags,
      tarePerBagKg: s.tarePerBagKg,
      moisturePct: s.moisturePct,
      dustKg: s.dustKg,
      bhav: s.bhav ?? 0,
    },
    heads,
    rates,
  );
  await tx
    .update(lotSales)
    .set({
      tareKg: r.tareKg,
      moistureKg: r.moistureKg,
      netKg: r.netKg,
      grossAmount: r.grossAmount,
      valueCut: r.valueCut,
      amount: r.amount,
      updatedAt: new Date(),
    })
    .where(eq(lotSales.id, saleId));
  return r;
}

function assertEditable(sales: { parchiId: number | null; billId: number | null }[]) {
  if (sales.some((s) => s.parchiId || s.billId)) {
    fail(
      "इस ढेरी की पर्ची या बिल बन चुका है। बदलाव पर्ची/बिल से 'सुधार' करके करें।",
      "A parchi or bill already exists for this lot. Use 'Edit' on the parchi/bill.",
    );
  }
}

export interface BoliPart {
  id?: number;
  vyapariId: number;
  bhav: Num;
  bags: number;
  saleType?: "private" | "sarkari";
}

/** Boli: vyapari and bhav for a dheri, optionally split across vyaparis (part bori to each). */
export async function saveBoli(tx: DbOrTx, actor: Actor, lotId: number, parts: BoliPart[]) {
  const lot = await getLot(tx, lotId);
  await assertDayOpen(tx, lot.date);
  if (!parts.length) fail("व्यापारी और भाव डालें", "Enter vyapari and bhav");
  const existing = await tx.select().from(lotSales).where(eq(lotSales.lotId, lotId)).orderBy(asc(lotSales.id));
  assertEditable(existing);
  const [c] = await tx.select().from(commodities).where(eq(commodities.id, lot.commodityId));

  for (const p of parts) {
    if (!d(p.bhav).gt(0)) fail("भाव डालें", "Enter bhav");
    const buyer = await getAccount(tx, p.vyapariId);
    if (!["vyapari", "agency"].includes(buyer.partyType)) fail("व्यापारी चुनें", "Choose a vyapari");
  }
  const keepIds = parts.filter((p) => p.id).map((p) => p.id as number);
  const toDelete = existing.filter((s) => !keepIds.includes(s.id));
  // The first unsplit placeholder (no vyapari yet) is reused for the first new part.
  const reusable = toDelete.filter((s) => !s.vyapariId && d(s.grossKg).isZero());
  for (const p of parts) {
    const buyer = await getAccount(tx, p.vyapariId);
    const saleType = p.saleType ?? (buyer.partyType === "agency" ? "sarkari" : "private");
    const values = {
      vyapariId: p.vyapariId,
      bhav: m2(p.bhav),
      bags: p.bags || 0,
      saleType,
      boliAt: new Date(),
      updatedAt: new Date(),
    };
    let id = p.id;
    if (!id && reusable.length) {
      id = reusable.shift()!.id;
      toDelete.splice(toDelete.findIndex((s) => s.id === id), 1);
    }
    if (id) {
      await tx.update(lotSales).set(values).where(and(eq(lotSales.id, id), eq(lotSales.lotId, lotId)));
    } else {
      const [row] = await tx
        .insert(lotSales)
        .values({
          lotId,
          ...values,
          weighMode: c.weighMode,
          tarePerBagKg: c.defaultTareKg,
          moisturePct: c.defaultMoisturePct,
        })
        .returning();
      id = row.id;
    }
    await recomputeSale(tx, id);
  }
  if (toDelete.length) {
    await tx.delete(lotSales).where(inArray(lotSales.id, toDelete.map((s) => s.id)));
  }
  const totalBags = parts.reduce((a, p) => a + (p.bags || 0), 0);
  if (totalBags > lot.bags) await tx.update(lots).set({ bags: totalBags }).where(eq(lots.id, lotId));
  await audit(tx, actor, { table: "lots", rowId: lotId, action: "boli", oldData: existing, newData: parts });
  return refreshLotStatus(tx, lotId);
}

export interface TulaiInput {
  weighMode?: "total" | "bagwise";
  bags?: number;
  grossKg?: Num;
  bagKgs?: Num[];
  tarePerBagKg?: Num;
  moisturePct?: Num;
  dustKg?: Num;
}

async function applyTulai(tx: DbOrTx, saleId: number, t: TulaiInput) {
  const mode = t.weighMode ?? "total";
  let gross = d(t.grossKg);
  let bags = t.bags;
  await tx.delete(lotBagWeights).where(eq(lotBagWeights.lotSaleId, saleId));
  if (mode === "bagwise") {
    const kgs = (t.bagKgs ?? []).filter((k) => d(k).gt(0));
    gross = bagwiseGross(kgs);
    bags = kgs.length;
    if (kgs.length) {
      await tx.insert(lotBagWeights).values(kgs.map((k, i) => ({ lotSaleId: saleId, bagNo: i + 1, kg: m2(k) })));
    }
  }
  const set: Partial<typeof lotSales.$inferInsert> = {
    weighMode: mode,
    grossKg: m2(gross),
    tarePerBagKg: m2(t.tarePerBagKg ?? 0),
    moisturePct: d(t.moisturePct).toFixed(4),
    dustKg: m2(t.dustKg ?? 0),
    tulaiAt: new Date(),
  };
  if (bags !== undefined) set.bags = bags;
  await tx.update(lotSales).set(set).where(eq(lotSales.id, saleId));
  return recomputeSale(tx, saleId);
}

/** Tulai: weights and katauti for one sale line (before any parchi/bill exists). */
export async function saveTulai(tx: DbOrTx, actor: Actor, saleId: number, t: TulaiInput) {
  const [s] = await tx.select().from(lotSales).where(eq(lotSales.id, saleId));
  if (!s) fail("ढेरी नहीं मिली", "Lot not found");
  const lot = await getLot(tx, s.lotId);
  await assertDayOpen(tx, lot.date);
  assertEditable([s]);
  if (t.weighMode !== "bagwise" && !d(t.grossKg).gt(0)) fail("वज़न डालें", "Enter weight");
  const r = await applyTulai(tx, saleId, t);
  await audit(tx, actor, { table: "lot_sales", rowId: saleId, action: "tulai", oldData: s, newData: t });
  await refreshLotStatus(tx, lot.id);
  return r;
}

/**
 * Edit a sale that is already on a parchi and/or bill (bhav or weights). The
 * affected documents are reversed and re-posted with the same numbers.
 * Printed documents need edit_printed permission and a reason (PRD §5.5).
 */
export async function editSale(
  tx: DbOrTx,
  actor: Actor,
  saleId: number,
  change: { bhav?: Num; tulai?: TulaiInput },
  reason: string,
  repost: (docType: "parchi" | "bill", id: number) => Promise<void>,
  printCount: (docType: "parchi" | "bill", id: number) => Promise<number>,
) {
  const [s] = await tx.select().from(lotSales).where(eq(lotSales.id, saleId)).for("update");
  if (!s) fail("ढेरी नहीं मिली", "Lot not found");
  const lot = await getLot(tx, s.lotId);
  await assertDayOpen(tx, lot.date);
  const printed =
    (s.parchiId ? await printCount("parchi", s.parchiId) : 0) + (s.billId ? await printCount("bill", s.billId) : 0) > 0;
  if (printed) {
    if (!can(actor.role, "edit_printed")) fail("छपी पर्ची/बिल केवल मालिक या मुनीम बदल सकते हैं", "Only malik or munim can edit a printed parchi or bill");
    if (!reason.trim()) fail("बदलाव का कारण लिखें", "Write the reason for the change");
  }
  if (change.bhav !== undefined) {
    if (!d(change.bhav).gt(0)) fail("भाव डालें", "Enter bhav");
    await tx.update(lotSales).set({ bhav: m2(change.bhav) }).where(eq(lotSales.id, saleId));
  }
  if (change.tulai) await applyTulai(tx, saleId, change.tulai);
  else await recomputeSale(tx, saleId);
  const [after] = await tx.select().from(lotSales).where(eq(lotSales.id, saleId));
  await audit(tx, actor, { table: "lot_sales", rowId: saleId, action: "edit", oldData: s, newData: after, reason });
  if (s.parchiId) await repost("parchi", s.parchiId);
  if (s.billId) await repost("bill", s.billId);
  return after;
}

/** Day's average bhav for a jins and the warning band (PRD §5.3: ±15%, configurable). */
export async function bhavRange(tx: DbOrTx, date: string, commodityId: number, pct: Num) {
  const rows = await tx.execute<{ avg: string | null; n: number }>(sql`
    SELECT AVG(ls.bhav)::numeric(14,2) AS avg, COUNT(*)::int AS n
    FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id
    WHERE l.date = ${date} AND l.commodity_id = ${commodityId} AND ls.bhav IS NOT NULL AND ls.sale_type = 'private'`);
  const avg = rows[0]?.avg;
  if (!avg || Number(rows[0].n) < 1) return null;
  const a = d(avg);
  const p = d(pct).dividedBy(100);
  return { avg: m2(a), low: m2(a.times(d(1).minus(p))), high: m2(a.times(d(1).plus(p))), count: Number(rows[0].n) };
}
