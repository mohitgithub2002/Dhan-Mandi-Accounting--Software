import Decimal from "decimal.js";

/** Isolated Decimal constructor: 40 significant digits, half-up rounding (mandi practice). */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type Num = Dec | string | number;

export const ZERO = new D(0);

export function d(v: Num | null | undefined): Dec {
  if (v === null || v === undefined || v === "") return new D(0);
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").trim();
    if (s === "" || s === "-" || s === ".") return new D(0);
    try {
      return new D(s);
    } catch {
      return new D(0);
    }
  }
  return new D(v);
}

export type Rounding = "none" | "nearest_1" | "nearest_0_10" | "up_1";

export const ROUNDINGS: Rounding[] = ["none", "nearest_1", "nearest_0_10", "up_1"];

/** Round a money value by a kharcha / firm rounding rule. `none` still rounds to the paisa. */
export function roundBy(v: Num, rule: Rounding | string): Dec {
  const x = d(v);
  switch (rule) {
    case "nearest_1":
      return x.toDecimalPlaces(0, D.ROUND_HALF_UP);
    case "nearest_0_10":
      return x.toDecimalPlaces(1, D.ROUND_HALF_UP);
    case "up_1":
      return x.toDecimalPlaces(0, D.ROUND_CEIL);
    default:
      return x.toDecimalPlaces(2, D.ROUND_HALF_UP);
  }
}

export const r2 = (v: Num) => d(v).toDecimalPlaces(2, D.ROUND_HALF_UP);

export function sum(values: Num[]): Dec {
  return values.reduce<Dec>((acc, v) => acc.plus(d(v)), new D(0));
}

/** Money string for the DB: always 2 decimals. */
export const m2 = (v: Num) => r2(v).toFixed(2);

/** Indian digit grouping: 1,22,500.00 */
export function formatINR(v: Num | null | undefined, decimals = 2): string {
  const x = d(v);
  const neg = x.isNegative() && !x.isZero();
  const fixed = x.abs().toFixed(decimals);
  const [intPart, frac] = fixed.split(".");
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${rest},${last3}`;
  }
  return `${neg ? "-" : ""}${grouped}${frac ? "." + frac : ""}`;
}

/** Balance side for display: naam (debit) positive, jama (credit) negative. */
export function sideOf(balance: Num): "jama" | "naam" | null {
  const x = d(balance);
  if (x.isZero()) return null;
  return x.gt(0) ? "naam" : "jama";
}
