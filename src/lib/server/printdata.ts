import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { accounts, billLines, bills, commodities, documentCharges, parchiLines, parchis } from "@/db/schema";
import { getFirm } from "./core";
import { getOverrides } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/dict";

export type PrintLang = "hi" | "en" | "both";

/** Label for a print in Hindi, English or both ("तुलाई / Tulai"). */
export async function printLabels(lang: PrintLang) {
  const o = await getOverrides();
  const hi = makeT("hi", o);
  const en = makeT("en", o);
  const L = (key: string) => (lang === "hi" ? hi(key) : lang === "en" ? en(key) : hi(key) === en(key) ? hi(key) : `${hi(key)} / ${en(key)}`);
  const T = (h: string, e: string) => (lang === "hi" ? h : lang === "en" ? e : `${h} / ${e}`);
  return { L, T };
}

export const nameIn = (lang: PrintLang, a: { nameHi: string; nameEn: string }) =>
  lang === "en" ? a.nameEn || a.nameHi : lang === "hi" ? a.nameHi || a.nameEn : a.nameHi && a.nameEn ? `${a.nameHi} / ${a.nameEn}` : a.nameHi || a.nameEn;

export async function resolvePrintLang(q: string | undefined): Promise<PrintLang> {
  if (q === "hi" || q === "en" || q === "both") return q;
  const f = await getFirm(db);
  return (f.defaultLang as PrintLang) ?? "both";
}

const vy = alias(accounts, "vy");

export async function loadParchi(id: number) {
  const [p] = await db.select().from(parchis).where(eq(parchis.id, id));
  if (!p) return null;
  const [kisan] = await db.select().from(accounts).where(eq(accounts.id, p.kisanId));
  const lines = await db
    .select({
      id: parchiLines.id,
      lotSaleId: parchiLines.lotSaleId,
      bags: parchiLines.bags,
      netKg: parchiLines.netKg,
      bhav: parchiLines.bhav,
      amount: parchiLines.amount,
      jinsHi: commodities.nameHi,
      jinsEn: commodities.nameEn,
      vyapariHi: vy.nameHi,
      vyapariEn: vy.nameEn,
      vyapariId: parchiLines.vyapariId,
    })
    .from(parchiLines)
    .innerJoin(commodities, eq(commodities.id, parchiLines.commodityId))
    .leftJoin(vy, eq(vy.id, parchiLines.vyapariId))
    .where(eq(parchiLines.parchiId, id))
    .orderBy(asc(parchiLines.id));
  const charges = await db
    .select()
    .from(documentCharges)
    .where(and(eq(documentCharges.docType, "parchi"), eq(documentCharges.docId, id)))
    .orderBy(asc(documentCharges.seq));
  const firm = await getFirm(db);
  return { p, kisan, lines, charges, firm };
}

const ki = alias(accounts, "ki");

export async function loadBill(id: number) {
  const [b] = await db.select().from(bills).where(eq(bills.id, id));
  if (!b) return null;
  const [vyapari] = await db.select().from(accounts).where(eq(accounts.id, b.vyapariId));
  const lines = await db
    .select({
      id: billLines.id,
      lotSaleId: billLines.lotSaleId,
      bags: billLines.bags,
      netKg: billLines.netKg,
      bhav: billLines.bhav,
      amount: billLines.amount,
      jinsHi: commodities.nameHi,
      jinsEn: commodities.nameEn,
      kisanHi: ki.nameHi,
      kisanEn: ki.nameEn,
      kisanId: billLines.kisanId,
    })
    .from(billLines)
    .innerJoin(commodities, eq(commodities.id, billLines.commodityId))
    .leftJoin(ki, eq(ki.id, billLines.kisanId))
    .where(eq(billLines.billId, id))
    .orderBy(asc(billLines.id));
  const charges = await db
    .select()
    .from(documentCharges)
    .where(and(eq(documentCharges.docType, "bill"), eq(documentCharges.docId, id)))
    .orderBy(asc(documentCharges.seq));
  const firm = await getFirm(db);
  const banks = await db.select().from(accounts).where(and(eq(accounts.partyType, "bank"), eq(accounts.active, true)));
  return { b, vyapari, lines, charges, firm, banks };
}
