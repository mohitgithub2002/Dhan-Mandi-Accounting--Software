"use client";
import { useEffect, useMemo, useState } from "react";
import { getRateContext } from "@/actions/entry";
import {
  billTotals,
  computeCharges,
  computeSale,
  formatINR,
  formatQtlKg,
  parchiTotals,
  type HeadDef,
  type ResolvedRates,
  type SaleResult,
} from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";
import { cx } from "./ui";

export interface RateCtx {
  heads: HeadDef[];
  kisanRates: ResolvedRates;
  vyapariRates: ResolvedRates;
  totalRounding: string;
  bhavRange: { avg: string; low: string; high: string; count: number } | null;
}

/** Loads heads + rates for the live panel whenever date / parties / jins change. */
export function useRateContext(date: string, saleType: string, kisanId: number | null, vyapariId: number | null, commodityId: number | null) {
  const [ctx, setCtx] = useState<RateCtx | null>(null);
  useEffect(() => {
    let alive = true;
    getRateContext({ date, saleType, kisanId, vyapariId, commodityId })
      .then((c) => alive && setCtx(c))
      .catch(() => alive && setCtx(null));
    return () => {
      alive = false;
    };
  }, [date, saleType, kisanId, vyapariId, commodityId]);
  return ctx;
}

export interface LiveInput {
  commodityId: number | null;
  bags: number;
  bhav: string;
  grossKg: string;
  tarePerBagKg: string;
  moisturePct: string;
  dustKg: string;
}

/** The same calc module the server posts with, run on every keystroke (PRD §9 rule 7). */
export function useLiveCalc(ctx: RateCtx | null, i: LiveInput) {
  return useMemo(() => {
    if (!ctx || !i.commodityId) return null;
    const sale: SaleResult = computeSale(
      { commodityId: i.commodityId, grossKg: i.grossKg || 0, bags: i.bags || 0, tarePerBagKg: i.tarePerBagKg || 0, moisturePct: i.moisturePct || 0, dustKg: i.dustKg || 0, bhav: i.bhav || 0 },
      ctx.heads,
      ctx.kisanRates,
    );
    const line = [{ commodityId: i.commodityId, netKg: sale.netKg, bags: i.bags || 0, amount: sale.amount }];
    const parchi = parchiTotals(line, computeCharges(ctx.heads, ctx.kisanRates, line), ctx.totalRounding);
    const bill = billTotals(line, computeCharges(ctx.heads, ctx.vyapariRates, line), ctx.totalRounding);
    return { sale, parchi, bill };
  }, [ctx, i.commodityId, i.bags, i.bhav, i.grossKg, i.tarePerBagKg, i.moisturePct, i.dustKg]);
}

export function LivePanel({ calc }: { calc: ReturnType<typeof useLiveCalc> }) {
  const { tx, t, lang } = useI18n();
  if (!calc) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-4 text-slate-500">{tx("किसान, जिंस और भाव डालें", "Enter kisan, jins and bhav")}</div>;
  }
  const { sale, parchi, bill } = calc;
  const name = (c: { nameHi: string; nameEn: string }) => (lang === "en" ? c.nameEn : c.nameHi);
  const row = (label: React.ReactNode, value: string, cls = "", key?: string | number) => (
    <div key={key} className={cx("flex justify-between gap-3 py-0.5", cls)}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
  return (
    <div className="rounded-lg border-2 border-brand-600 bg-brand-50 p-4" aria-live="polite">
      <div className="mb-2 border-b border-brand-100 pb-2">
        {row(t("netWeight"), formatQtlKg(sale.netKg, lang))}
        {Number(sale.tareKg) || Number(sale.moistureKg) || Number(sale.dustKg)
          ? row(<span className="text-sm text-slate-600">{t("katauti")}</span>, `${formatINR(Number(sale.tareKg) + Number(sale.moistureKg) + Number(sale.dustKg))} kg`, "text-sm text-slate-600")
          : null}
        {row(<b>{t("rakam")}</b>, formatINR(sale.grossAmount), "text-lg font-bold")}
        {sale.cuts.map((c) => row(`− ${name(c)}`, formatINR(c.amount), "text-sm", c.headId))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 font-semibold text-slate-700">{t("kisanParchi")}</div>
          {parchi.charges.map((c) => row(`− ${name(c)}${c.postMode === "show" ? " *" : ""}`, formatINR(c.kisanAmount), "text-sm", c.headId))}
          {row(<b>{t("parchiNet")}</b>, formatINR(parchi.net), "mt-1 border-t border-slate-300 pt-1 text-lg font-bold text-jama")}
        </div>
        <div>
          <div className="mb-1 font-semibold text-slate-700">{t("vyapariBill")}</div>
          {bill.lines.map((c) => row(`+ ${name(c)}${c.postMode === "show" ? " *" : ""}`, formatINR(c.vyapariAmount), "text-sm", c.headId))}
          {row(<b>{t("billTotal")}</b>, formatINR(bill.total), "mt-1 border-t border-slate-300 pt-1 text-lg font-bold text-naam")}
        </div>
      </div>
    </div>
  );
}

/** Warning, not a block, when bhav is outside the day's range (PRD §5.3). */
export function BhavWarning({ ctx, bhav }: { ctx: RateCtx | null; bhav: string }) {
  const { tx } = useI18n();
  const r = ctx?.bhavRange;
  const b = Number(bhav);
  if (!r || !b) return null;
  if (b >= Number(r.low) && b <= Number(r.high)) return null;
  return (
    <span className="text-sm font-medium text-amber-800">
      ⚠ {tx("आज का औसत भाव", "Today's average")} ₹{formatINR(r.avg)} ({formatINR(r.low)} – {formatINR(r.high)})
    </span>
  );
}
