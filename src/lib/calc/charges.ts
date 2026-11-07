/**
 * Kharcha aur tax engine (PRD §6). Pure functions — no DB access — so the same
 * code runs for the live preview, the posting service and the print.
 */
import { D, d, m2, r2, roundBy, sum, type Dec, type Num, type Rounding } from "./money";
import { computeNetWeight, rakam, type TulaiInput } from "./weight";

export type Basis = "pct_amount" | "per_qtl" | "per_bag" | "fixed_doc" | "pct_of_line";
export type Payer = "kisan" | "vyapari" | "split";
export type PostMode = "income" | "payable" | "show";
export type Kind = "kharcha" | "shulk" | "katauti" | "gst";
export type Side = "kisan" | "vyapari";

export const BASES: Basis[] = ["pct_amount", "per_qtl", "per_bag", "fixed_doc", "pct_of_line"];
export const PAYERS: Payer[] = ["kisan", "vyapari", "split"];
export const POST_MODES: PostMode[] = ["income", "payable", "show"];
export const KINDS: Kind[] = ["kharcha", "shulk", "katauti", "gst"];

export interface HeadDef {
  id: number;
  code: string;
  nameHi: string;
  nameEn: string;
  kind: Kind | string;
  basis: Basis | string;
  refHeadId: number | null;
  payer: Payer | string;
  splitKisanPct: string;
  postMode: PostMode | string;
  postAccountId: number | null;
  seq: number;
  rounding: Rounding | string;
  onParchi: boolean;
  onBill: boolean;
}

/**
 * Rates already resolved for one date and one document party (see server/rates.ts).
 * `byCommodity` wins over `generic`; a head with neither does not apply.
 */
export type ResolvedRates = Record<number, { generic: string | null; byCommodity: Record<number, string> }>;

export function rateFor(rates: ResolvedRates, headId: number, commodityId: number | null): Dec | null {
  const r = rates[headId];
  if (!r) return null;
  if (commodityId !== null && r.byCommodity[commodityId] !== undefined) return d(r.byCommodity[commodityId]);
  if (r.generic !== null && r.generic !== undefined) return d(r.generic);
  return null;
}

export interface SaleLine {
  commodityId: number;
  netKg: Num;
  bags: number;
  amount: Num; // rakam after value katauti
}

export interface ChargeLine {
  headId: number;
  code: string;
  nameHi: string;
  nameEn: string;
  kind: string;
  basis: string;
  basisValue: string;
  rateUsed: string | null;
  fullAmount: string;
  kisanAmount: string;
  vyapariAmount: string;
  payer: string;
  postMode: string;
  postAccountId: number | null;
  seq: number;
  onParchi: boolean;
  onBill: boolean;
}

const bySeq = (a: HeadDef, b: HeadDef) => a.seq - b.seq || a.id - b.id;

/** Compute every applicable kharcha line (both payers) for one document's sale lines. */
export function computeCharges(heads: HeadDef[], rates: ResolvedRates, lines: SaleLine[]): ChargeLine[] {
  const out: ChargeLine[] = [];
  const fullById = new Map<number, Dec>();
  const firstCommodity = lines[0]?.commodityId ?? null;
  if (lines.length === 0) return out;

  for (const h of [...heads].filter((x) => x.kind !== "katauti").sort(bySeq)) {
    let raw = new D(0);
    let basisValue = new D(0);
    const usedRates = new Set<string>();
    let applies = false;

    if (h.basis === "fixed_doc" || h.basis === "pct_of_line") {
      const r = rateFor(rates, h.id, firstCommodity);
      if (r === null) continue;
      if (h.basis === "fixed_doc") {
        basisValue = new D(1);
        raw = r;
      } else {
        const ref = h.refHeadId !== null ? fullById.get(h.refHeadId) : undefined;
        if (ref === undefined) continue; // referenced line not on this document
        basisValue = ref;
        raw = ref.times(r).dividedBy(100);
      }
      usedRates.add(r.toString());
      applies = true;
    } else {
      for (const line of lines) {
        const r = rateFor(rates, h.id, line.commodityId);
        if (r === null) continue;
        let b: Dec;
        if (h.basis === "pct_amount") b = d(line.amount);
        else if (h.basis === "per_qtl") b = d(line.netKg).dividedBy(100);
        else if (h.basis === "per_bag") b = d(line.bags);
        else continue;
        basisValue = basisValue.plus(b);
        raw = raw.plus(h.basis === "pct_amount" ? b.times(r).dividedBy(100) : b.times(r));
        usedRates.add(r.toString());
        applies = true;
      }
    }
    if (!applies) continue;

    const full = roundBy(raw, h.rounding);
    fullById.set(h.id, full);

    let kisan = new D(0);
    let vyapari = new D(0);
    if (h.payer === "kisan") kisan = full;
    else if (h.payer === "vyapari") vyapari = full;
    else {
      kisan = r2(full.times(d(h.splitKisanPct)).dividedBy(100));
      vyapari = full.minus(kisan);
    }

    out.push({
      headId: h.id,
      code: h.code,
      nameHi: h.nameHi,
      nameEn: h.nameEn,
      kind: h.kind,
      basis: h.basis,
      basisValue: basisValue.toDecimalPlaces(4).toString(),
      rateUsed: usedRates.size === 1 ? [...usedRates][0] : null,
      fullAmount: m2(full),
      kisanAmount: m2(kisan),
      vyapariAmount: m2(vyapari),
      payer: h.payer,
      postMode: h.postMode,
      postAccountId: h.postAccountId,
      seq: h.seq,
      onParchi: h.onParchi,
      onBill: h.onBill,
    });
  }
  return out;
}

/** Lines that belong to one side (non-zero share). */
export function sideLines(charges: ChargeLine[], side: Side): ChargeLine[] {
  return charges.filter((c) => !d(side === "kisan" ? c.kisanAmount : c.vyapariAmount).isZero());
}

export const shareOf = (c: ChargeLine, side: Side) => d(side === "kisan" ? c.kisanAmount : c.vyapariAmount);

export interface ParchiTotals {
  gross: string;
  deductions: string; // posted kisan-side kharcha
  rawNet: string;
  net: string; // credited to kisan khata
  roundOff: string; // net − rawNet
  peshgiRecovered: string;
  payable: string; // net − peshgi recovered
  charges: ChargeLine[]; // kisan-side lines (incl. show-only)
}

export function parchiTotals(
  lines: SaleLine[],
  charges: ChargeLine[],
  totalRounding: Rounding | string,
  peshgiRecovered: Num = 0,
): ParchiTotals {
  const gross = r2(sum(lines.map((l) => l.amount)));
  const mine = sideLines(charges, "kisan");
  const deductions = sum(mine.filter((c) => c.postMode !== "show").map((c) => c.kisanAmount));
  const rawNet = gross.minus(deductions);
  const net = roundBy(rawNet, totalRounding);
  const p = r2(peshgiRecovered);
  return {
    gross: m2(gross),
    deductions: m2(deductions),
    rawNet: m2(rawNet),
    net: m2(net),
    roundOff: m2(net.minus(rawNet)),
    peshgiRecovered: m2(p),
    payable: m2(net.minus(p)),
    charges: mine,
  };
}

export interface BillTotals {
  amount: string;
  charges: string; // posted vyapari-side kharcha
  rawTotal: string;
  total: string;
  roundOff: string;
  lines: ChargeLine[];
}

export function billTotals(lines: SaleLine[], charges: ChargeLine[], totalRounding: Rounding | string): BillTotals {
  const amount = r2(sum(lines.map((l) => l.amount)));
  const mine = sideLines(charges, "vyapari");
  const chargeSum = sum(mine.filter((c) => c.postMode !== "show").map((c) => c.vyapariAmount));
  const rawTotal = amount.plus(chargeSum);
  const total = roundBy(rawTotal, totalRounding);
  return {
    amount: m2(amount),
    charges: m2(chargeSum),
    rawTotal: m2(rawTotal),
    total: m2(total),
    roundOff: m2(total.minus(rawTotal)),
    lines: mine,
  };
}

/* ------------------------------------------------------------ one sale */

export interface SaleInput extends TulaiInput {
  commodityId: number;
  bhav: Num;
}

export interface SaleResult {
  grossKg: string;
  tareKg: string;
  moistureKg: string;
  dustKg: string;
  netKg: string;
  grossAmount: string; // net qtl × bhav
  valueCut: string;
  amount: string; // grossAmount − valueCut
  cuts: { headId: number; code: string; nameHi: string; nameEn: string; amount: string }[];
}

/**
 * Weight katauti → net kg → rakam → value katauti (PRD §6 calculation order steps 1–2).
 * Value katauti is computed per sale so parchi and bill use the identical rakam.
 */
export function computeSale(i: SaleInput, heads: HeadDef[], rates: ResolvedRates): SaleResult {
  const w = computeNetWeight(i);
  const grossAmount = rakam(w.netKg, i.bhav);
  const cuts: SaleResult["cuts"] = [];
  for (const h of heads.filter((x) => x.kind === "katauti").sort(bySeq)) {
    const r = rateFor(rates, h.id, i.commodityId);
    if (r === null) continue;
    let raw: Dec;
    if (h.basis === "pct_amount") raw = grossAmount.times(r).dividedBy(100);
    else if (h.basis === "per_qtl") raw = w.netKg.dividedBy(100).times(r);
    else if (h.basis === "per_bag") raw = r.times(i.bags || 0);
    else if (h.basis === "fixed_doc") raw = r;
    else continue;
    const amt = roundBy(raw, h.rounding);
    if (amt.isZero()) continue;
    cuts.push({ headId: h.id, code: h.code, nameHi: h.nameHi, nameEn: h.nameEn, amount: m2(amt) });
  }
  const valueCut = sum(cuts.map((c) => c.amount));
  return {
    grossKg: m2(w.grossKg),
    tareKg: m2(w.tareKg),
    moistureKg: m2(w.moistureKg),
    dustKg: m2(w.dustKg),
    netKg: m2(w.netKg),
    grossAmount: m2(grossAmount),
    valueCut: m2(valueCut),
    amount: m2(grossAmount.minus(valueCut)),
    cuts,
  };
}
