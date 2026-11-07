"use server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lotSales } from "@/db/schema";
import { runAction } from "@/lib/server/action";
import { requireActor } from "@/lib/server/auth";
import { getAccount, getFirm } from "@/lib/server/core";
import {
  editSaleAndRepost,
  makeBills,
  makeParchis,
  markPrinted,
  raddBill,
  raddParchi,
  setParchiPeshgi,
} from "@/lib/server/documents";
import { fail } from "@/lib/server/errors";
import { rateContext } from "@/lib/server/rates";
import { bhavRange, createArrival, saveBoli, saveTulai } from "@/lib/server/sales";
import { parse, z, zDate, zId, zNum, zOptNum } from "@/lib/server/validate";

const PATHS = ["/"];

/** Heads and rates for the live panel: kisan side and vyapari side (PRD §9 rule 7). */
export async function getRateContext(input: { date: string; saleType: string; kisanId: number | null; vyapariId: number | null; commodityId: number | null }) {
  await requireActor();
  const i = parse(
    z.object({ date: zDate, saleType: z.enum(["private", "sarkari"]), kisanId: zId.nullable(), vyapariId: zId.nullable(), commodityId: zId.nullable() }),
    input,
  );
  const firm = await getFirm(db);
  const k = await rateContext(db, i.date, i.saleType, i.kisanId);
  const v = await rateContext(db, i.date, i.saleType, i.vyapariId);
  const range = i.commodityId ? await bhavRange(db, i.date, i.commodityId, firm.bhavWarnPct) : null;
  return { heads: k.heads, kisanRates: k.rates, vyapariRates: v.rates, totalRounding: firm.totalRounding, bhavRange: range };
}

const tulaiSchema = z.object({
  weighMode: z.enum(["total", "bagwise"]).default("total"),
  bags: z.coerce.number().int().min(0).optional(),
  grossKg: zOptNum,
  bagKgs: z.array(zNum).optional(),
  tarePerBagKg: zOptNum,
  moisturePct: zOptNum,
  dustKg: zOptNum,
});

const dheriSchema = z.object({
  date: zDate,
  kisanId: zId,
  gateEntryNo: z.string().default(""),
  vehicleNo: z.string().default(""),
  commodityId: zId,
  bags: z.coerce.number().int().min(0),
  qualityNote: z.string().default(""),
  vyapariId: zId.nullable().optional(),
  bhav: zOptNum,
  tulai: tulaiSchema.nullable().optional(),
  print: z.boolean().default(false),
});

/** Dheri Entry: aamad + boli + tulai in one go, optionally the parchi (PRD §9 rule 5). */
export async function saveDheri(input: unknown) {
  return runAction(
    "entry",
    async (tx, actor) => {
      const i = parse(dheriSchema, input);
      const a = await createArrival(tx, actor, {
        date: i.date,
        kisanId: i.kisanId,
        gateEntryNo: i.gateEntryNo,
        vehicleNo: i.vehicleNo,
        lots: [{ commodityId: i.commodityId, bags: i.bags, qualityNote: i.qualityNote }],
      });
      const lotId = a.lotIds[0];
      let saleId = a.saleIds[0];
      let status = "aamad";
      if (i.vyapariId && i.bhav && Number(i.bhav) > 0) {
        status = await saveBoli(tx, actor, lotId, [{ vyapariId: i.vyapariId, bhav: i.bhav, bags: i.bags }]);
        const [s] = await tx.select().from(lotSales).where(eq(lotSales.lotId, lotId));
        saleId = s.id;
        const t = i.tulai;
        if (t && (Number(t.grossKg ?? 0) > 0 || (t.bagKgs ?? []).some((k) => Number(k) > 0))) {
          await saveTulai(tx, actor, saleId, { ...t, bags: t.weighMode === "bagwise" ? undefined : i.bags });
          status = "tulai";
        }
      }
      let parchiIds: number[] = [];
      if (i.print) {
        if (status !== "tulai") {
          fail("पर्ची के लिए व्यापारी, भाव और वज़न ज़रूरी है", "Vyapari, bhav and weight are needed for the parchi");
        }
        const firm = await getFirm(tx);
        const made =
          firm.parchiMode === "per_dheri"
            ? await makeParchis(tx, actor, { lotIds: [lotId] })
            : await makeParchis(tx, actor, { date: i.date, kisanId: i.kisanId });
        parchiIds = made.map((p) => p.id);
      }
      return { arrivalNo: a.arrivalNo, lotId, saleId, status, parchiIds };
    },
    { revalidate: PATHS },
  );
}

export async function saveArrival(input: unknown) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(
      z.object({
        date: zDate,
        kisanId: zId,
        gateEntryNo: z.string().default(""),
        vehicleNo: z.string().default(""),
        remarks: z.string().default(""),
        lots: z.array(z.object({ commodityId: zId, bags: z.coerce.number().int().min(0), qualityNote: z.string().default("") })).min(1),
      }),
      input,
    );
    return createArrival(tx, actor, i);
  });
}

export async function saveBoliAction(input: unknown) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(
      z.object({
        lotId: zId,
        parts: z
          .array(z.object({ id: zId.optional(), vyapariId: zId, bhav: zNum, bags: z.coerce.number().int().min(0), saleType: z.enum(["private", "sarkari"]).optional() }))
          .min(1),
      }),
      input,
    );
    return saveBoli(tx, actor, i.lotId, i.parts);
  });
}

export async function saveTulaiAction(input: unknown) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(tulaiSchema.extend({ saleId: zId }), input);
    return saveTulai(tx, actor, i.saleId, i);
  });
}

export async function makeParchisAction(input: { date: string; kisanId?: number | null }) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(z.object({ date: zDate, kisanId: zId.nullable().optional() }), input);
    const made = await makeParchis(tx, actor, { date: i.date, kisanId: i.kisanId ?? undefined });
    return made.map((p) => ({ id: p.id, no: p.parchiNo }));
  });
}

export async function makeBillsAction(input: { date: string; vyapariId?: number | null }) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(z.object({ date: zDate, vyapariId: zId.nullable().optional() }), input);
    const made = await makeBills(tx, actor, { date: i.date, vyapariId: i.vyapariId ?? undefined });
    return made.map((b) => ({ id: b.id, no: b.billNo }));
  });
}

export async function raddDocAction(input: { docType: "parchi" | "bill"; id: number; reason: string }) {
  return runAction("radd", async (tx, actor) => {
    const i = parse(z.object({ docType: z.enum(["parchi", "bill"]), id: zId, reason: z.string() }), input);
    if (i.docType === "parchi") await raddParchi(tx, actor, i.id, i.reason);
    else await raddBill(tx, actor, i.id, i.reason);
    return true;
  });
}

export async function setPeshgiAction(input: { id: number; amount: string; reason: string }) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(z.object({ id: zId, amount: zNum, reason: z.string() }), input);
    await setParchiPeshgi(tx, actor, i.id, i.amount, i.reason);
    return true;
  });
}

export async function editSaleAction(input: unknown) {
  return runAction("entry", async (tx, actor) => {
    const i = parse(z.object({ saleId: zId, bhav: zOptNum, tulai: tulaiSchema.optional(), reason: z.string() }), input);
    await editSaleAndRepost(tx, actor, i.saleId, { bhav: i.bhav, tulai: i.tulai }, i.reason);
    return true;
  });
}

export async function markPrintedAction(input: { docType: "parchi" | "bill" | "voucher"; id: number }) {
  return runAction("print", async (tx, actor) => {
    const i = parse(z.object({ docType: z.enum(["parchi", "bill", "voucher"]), id: zId }), input);
    await markPrinted(tx, actor, i.docType, i.id);
    return true;
  }, { revalidate: [] }); // keep the page as printed (Original), no re-render
}

export async function partyBrief(id: number) {
  await requireActor();
  const a = await getAccount(db, id);
  return { id: a.id, partyType: a.partyType, creditDays: a.creditDays };
}
