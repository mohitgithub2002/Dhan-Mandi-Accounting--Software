/**
 * Byaj by daily product (PRD §5.10).
 *
 * Balance convention: naam (debit) is positive. For each day in the period the
 * end-of-day naam balance — less debits still inside the grace / credit days —
 * is added to the product. Jama balances earn nothing.
 *
 *   interest = product × rate% per month ÷ 100 ÷ days-in-month
 */
import { D, d, m2, roundBy, type Dec, type Num } from "./money";

export interface Movement {
  date: string; // YYYY-MM-DD
  debit: Num;
  credit: Num;
}

export interface InterestInput {
  /** Signed balance (naam +) at the start of `from` (i.e. end of the previous day). */
  openingBalance: Num;
  /** Ledger movements; entries before `from` must already be inside openingBalance. */
  movements: Movement[];
  /** Debits made within this many days are not yet due (grace days / vyapari credit days). */
  notDueDays?: number;
  /** Debits before `from` that may still be inside the not-due window. */
  priorDebits?: Movement[];
  from: string;
  to: string;
  ratePm: Num;
  daysInMonth?: number;
  method?: "simple" | "monthly" | "compound" | string;
}

export interface InterestResult {
  product: string;
  amount: string;
  days: number;
  months: { month: string; product: string; amount: string }[];
}

export function addDays(iso: string, n: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

export function computeInterest(i: InterestInput): InterestResult {
  const dim = i.daysInMonth ?? 30;
  const notDueDays = i.notDueDays ?? 0;
  const rate = d(i.ratePm);
  const byDate = new Map<string, Dec>();
  const debitsByDate = new Map<string, Dec>();
  for (const mv of [...(i.priorDebits ?? []), ...i.movements]) {
    if (mv.date >= i.from && mv.date <= i.to) {
      byDate.set(mv.date, (byDate.get(mv.date) ?? new D(0)).plus(d(mv.debit)).minus(d(mv.credit)));
    }
    if (notDueDays > 0 && !d(mv.debit).isZero()) {
      debitsByDate.set(mv.date, (debitsByDate.get(mv.date) ?? new D(0)).plus(d(mv.debit)));
    }
  }

  let balance = d(i.openingBalance);
  let product = new D(0);
  const monthly = new Map<string, Dec>();
  let days = 0;
  for (let day = i.from; day <= i.to; day = addDays(day, 1)) {
    balance = balance.plus(byDate.get(day) ?? 0);
    let due = balance;
    if (notDueDays > 0 && due.gt(0)) {
      let recent = new D(0);
      for (let k = 0; k < notDueDays; k++) recent = recent.plus(debitsByDate.get(addDays(day, -k)) ?? 0);
      due = due.minus(recent);
    }
    if (due.gt(0)) {
      product = product.plus(due);
      const mk = day.slice(0, 7);
      monthly.set(mk, (monthly.get(mk) ?? new D(0)).plus(due));
    }
    days++;
  }

  const toAmount = (p: Dec) => roundBy(p.times(rate).dividedBy(100).dividedBy(dim), "nearest_1");
  const months = [...monthly.entries()].map(([month, p]) => ({ month, product: m2(p), amount: m2(toAmount(p)) }));
  const amount =
    i.method === "monthly" ? months.reduce((a, x) => a.plus(d(x.amount)), new D(0)) : toAmount(product);
  return { product: m2(product), amount: m2(amount), days, months };
}
