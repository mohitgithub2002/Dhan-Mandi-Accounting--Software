import "server-only";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { accounts, interestLines, interestRules, interestRuns } from "@/db/schema";
import { addDays, computeInterest, d, m2 } from "@/lib/calc";
import { can } from "@/lib/permissions";
import { audit, getFirm, systemAccount, type Actor } from "./core";
import { fail } from "./errors";
import { balanceOf, movements, postVoucher } from "./ledger";

/** Latest active byaj rule of an account effective by `asOf`. */
export async function ruleFor(tx: DbOrTx, accountId: number, asOf: string) {
  const [r] = await tx
    .select()
    .from(interestRules)
    .where(and(eq(interestRules.accountId, accountId), eq(interestRules.active, true), lte(interestRules.effectiveFrom, asOf)))
    .orderBy(desc(interestRules.effectiveFrom), desc(interestRules.id))
    .limit(1);
  return r ?? null;
}

/** Last day already covered by a posted byaj run for this account. */
async function lastPostedTo(tx: DbOrTx, accountId: number): Promise<string | null> {
  const rows = await tx.execute<{ to: string | null }>(sql`
    SELECT MAX(r.period_to)::text AS to FROM interest_lines l
    JOIN interest_runs r ON r.id = l.run_id
    JOIN vouchers v ON v.id = l.voucher_id AND v.status = 'active'
    WHERE l.account_id = ${accountId}`);
  return rows[0]?.to ?? null;
}

export interface ByajLine {
  accountId: number;
  name: string;
  partyType: string;
  from: string;
  to: string;
  ratePm: string;
  method: string;
  product: string;
  amount: string;
  note?: string;
}

/** Byaj for one account over a period (no posting). */
export async function computeAccountByaj(tx: DbOrTx, accountId: number, from: string, to: string): Promise<ByajLine | null> {
  const [acc] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
  if (!acc) return null;
  const rule = await ruleFor(tx, accountId, to);
  if (!rule) return null;
  const start = rule.effectiveFrom > from ? rule.effectiveFrom : from;
  if (start > to) return null;
  const firm = await getFirm(tx);
  // Simple / monthly: posted byaj does not earn byaj. Compound: it does (it is in the ledger).
  const excludeTypes = rule.method === "compound" ? [] : ["byaj"];
  const opening = await balanceOf(tx, accountId, { before: start, excludeTypes });
  const mv = await movements(tx, accountId, start, to, { excludeTypes });
  const notDueDays = rule.overdueOnly ? acc.creditDays : rule.graceDays;
  const prior = notDueDays > 0 ? await movements(tx, accountId, addDays(start, -notDueDays), addDays(start, -1), { excludeTypes }) : [];
  const r = computeInterest({
    openingBalance: opening,
    movements: mv,
    priorDebits: prior.filter((x) => d(x.debit).gt(0)),
    notDueDays,
    from: start,
    to,
    ratePm: rule.ratePm,
    daysInMonth: firm.byajDaysInMonth,
    method: rule.method,
  });
  return {
    accountId,
    name: acc.nameHi || acc.nameEn,
    partyType: acc.partyType,
    from: start,
    to,
    ratePm: rule.ratePm,
    method: rule.method,
    product: r.product,
    amount: r.amount,
  };
}

/** Preview of a byaj run: every account with an active rule (optionally filtered). */
export async function previewByaj(
  tx: DbOrTx,
  f: { from: string; to: string; partyType?: string; accountIds?: number[] },
): Promise<ByajLine[]> {
  if (f.from > f.to) fail("तारीख़ ग़लत है", "From date is after to date");
  const ruleRows = await tx
    .selectDistinct({ accountId: interestRules.accountId })
    .from(interestRules)
    .innerJoin(accounts, eq(accounts.id, interestRules.accountId))
    .where(
      and(
        eq(interestRules.active, true),
        eq(accounts.active, true),
        f.partyType ? eq(accounts.partyType, f.partyType) : undefined,
        f.accountIds?.length ? inArray(interestRules.accountId, f.accountIds) : undefined,
      ),
    );
  const out: ByajLine[] = [];
  for (const { accountId } of ruleRows) {
    const last = await lastPostedTo(tx, accountId);
    let from = f.from;
    let note: string | undefined;
    if (last && last >= from) {
      from = addDays(last, 1);
      note = `पिछला ब्याज ${last} तक लगा / already posted to ${last}`;
    }
    if (from > f.to) continue;
    const line = await computeAccountByaj(tx, accountId, from, f.to);
    if (line && d(line.amount).gt(0)) out.push({ ...line, note });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Post the approved preview lines: one byaj voucher per party, party naam / byaj aamdani jama. */
export async function postByaj(tx: DbOrTx, actor: Actor, f: { from: string; to: string; accountIds: number[] }) {
  if (!can(actor.role, "byaj")) fail("ब्याज चलाने की अनुमति नहीं", "You cannot run byaj");
  const lines = await previewByaj(tx, { from: f.from, to: f.to, accountIds: f.accountIds });
  if (!lines.length) fail("कोई ब्याज नहीं बना", "No byaj to post");
  const income = await systemAccount(tx, "BYAJ_INCOME");
  const [run] = await tx.insert(interestRuns).values({ periodFrom: f.from, periodTo: f.to, createdBy: actor.id }).returning();
  for (const l of lines) {
    const v = await postVoucher(tx, actor, {
      type: "byaj",
      date: f.to,
      narration: `ब्याज / Byaj ${l.from} – ${l.to} @ ${d(l.ratePm)}% pm`,
      partyId: l.accountId,
      amount: l.amount,
      lines: [
        { accountId: l.accountId, debit: l.amount },
        { accountId: income, credit: l.amount },
      ],
    });
    await tx.insert(interestLines).values({
      runId: run.id,
      accountId: l.accountId,
      product: l.product,
      rate: l.ratePm,
      amount: m2(l.amount),
      voucherId: v.id,
    });
  }
  await audit(tx, actor, { table: "interest_runs", rowId: run.id, action: "create", newData: { ...f, lines } });
  return { runId: run.id, count: lines.length, total: m2(lines.reduce((a, l) => a.plus(d(l.amount)), d(0))) };
}

/** Byaj accrued but not posted, up to a date (khata "byaj sahit" toggle). */
export async function accruedByaj(tx: DbOrTx, accountId: number, asOf: string) {
  const rule = await ruleFor(tx, accountId, asOf);
  if (!rule) return null;
  const last = await lastPostedTo(tx, accountId);
  const from = last ? addDays(last, 1) : rule.effectiveFrom;
  if (from > asOf) return { from, to: asOf, amount: "0.00", ratePm: rule.ratePm };
  const line = await computeAccountByaj(tx, accountId, from, asOf);
  return line ? { from: line.from, to: asOf, amount: line.amount, ratePm: line.ratePm } : null;
}
