import { D, d, r2, sum, type Dec, type Num } from "./money";

export interface TulaiInput {
  grossKg: Num;
  bags: number;
  tarePerBagKg?: Num;
  moisturePct?: Num;
  dustKg?: Num;
}

export interface TulaiResult {
  grossKg: Dec;
  tareKg: Dec;
  moistureKg: Dec;
  dustKg: Dec;
  netKg: Dec;
}

/**
 * Net weight = gross − bag tare − nami (moisture % of gross after tare) − dust.
 * All weights in kg, rounded to 2 decimals (PRD §5.4, §10).
 */
export function computeNetWeight(i: TulaiInput): TulaiResult {
  const grossKg = r2(i.grossKg);
  const tareKg = r2(d(i.tarePerBagKg).times(i.bags || 0));
  const afterTare = grossKg.minus(tareKg);
  const moistureKg = r2(afterTare.times(d(i.moisturePct)).dividedBy(100));
  const dustKg = r2(i.dustKg ?? 0);
  let netKg = r2(grossKg.minus(tareKg).minus(moistureKg).minus(dustKg));
  if (netKg.isNegative()) netKg = new D(0);
  return { grossKg, tareKg, moistureKg, dustKg, netKg };
}

/** Gross from bag-wise weights. */
export const bagwiseGross = (bagKgs: Num[]) => r2(sum(bagKgs));

/** Rakam = net weight in quintal × bhav, to the paisa. */
export function rakam(netKg: Num, bhav: Num): Dec {
  return r2(d(netKg).dividedBy(100).times(d(bhav)));
}

/** "52 qtl 35 kg" / "52 क्विं. 35 कि.ग्रा." — stored in kg, shown in quintal-kilo. */
export function formatQtlKg(kgValue: Num, lang: "hi" | "en" = "en"): string {
  const x = d(kgValue);
  const neg = x.isNegative();
  const abs = x.abs();
  const qtl = abs.dividedToIntegerBy(100);
  const rest = abs.minus(qtl.times(100));
  const restStr = rest.isInteger() ? rest.toFixed(0) : rest.toFixed(2).replace(/0$/, "");
  const q = lang === "hi" ? "क्विं." : "qtl";
  const k = lang === "hi" ? "कि.ग्रा." : "kg";
  return `${neg ? "-" : ""}${qtl.toFixed(0)} ${q} ${restStr} ${k}`;
}

/** Quintal with 2 decimals for tables (52.35). */
export const toQtl = (kgValue: Num) => d(kgValue).dividedBy(100).toDecimalPlaces(2, D.ROUND_HALF_UP);
