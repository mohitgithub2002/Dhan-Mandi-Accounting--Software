import "server-only";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { chargeHeads, chargeRates } from "@/db/schema";
import type { HeadDef, ResolvedRates } from "@/lib/calc";

/** Kharcha heads active on a date for a sale type, in kram order. */
export async function loadHeads(tx: DbOrTx, date: string, saleType: string): Promise<HeadDef[]> {
  const rows = await tx
    .select()
    .from(chargeHeads)
    .where(
      and(
        lte(chargeHeads.activeFrom, date),
        or(isNull(chargeHeads.activeTo), gt(chargeHeads.activeTo, date)),
        or(eq(chargeHeads.saleType, "both"), eq(chargeHeads.saleType, saleType)),
      ),
    )
    .orderBy(asc(chargeHeads.seq), asc(chargeHeads.id));
  return rows.map((h) => ({
    id: h.id,
    code: h.code,
    nameHi: h.printLabelHi || h.nameHi,
    nameEn: h.printLabelEn || h.nameEn,
    kind: h.kind,
    basis: h.basis,
    refHeadId: h.refHeadId,
    payer: h.payer,
    splitKisanPct: h.splitKisanPct,
    postMode: h.postMode,
    postAccountId: h.postAccountId,
    seq: h.seq,
    rounding: h.rounding,
    onParchi: h.onParchi,
    onBill: h.onBill,
  }));
}

/**
 * Resolve rates for a date and one document party. Precedence per jins:
 * party+jins → party → jins → generic (PRD §6 "override per party").
 */
export async function resolveRates(
  tx: DbOrTx,
  heads: HeadDef[],
  date: string,
  partyId: number | null,
  allowOverride: Map<number, boolean>,
): Promise<ResolvedRates> {
  if (heads.length === 0) return {};
  const rows = await tx
    .select()
    .from(chargeRates)
    .where(
      and(
        sql`${chargeRates.chargeHeadId} IN (${sql.join(
          heads.map((h) => sql`${h.id}`),
          sql`, `,
        )})`,
        lte(chargeRates.effectiveFrom, date),
        or(isNull(chargeRates.effectiveTo), sql`${chargeRates.effectiveTo} >= ${date}`),
      ),
    )
    .orderBy(asc(chargeRates.effectiveFrom), asc(chargeRates.id));

  const out: ResolvedRates = {};
  for (const h of heads) {
    const mine = rows.filter((r) => r.chargeHeadId === h.id);
    const useParty = partyId !== null && allowOverride.get(h.id) !== false;
    // Later effective_from wins inside the same specificity (rows are sorted ascending).
    const pick = (f: (r: (typeof mine)[number]) => boolean) => {
      const m = mine.filter(f);
      return m.length ? m[m.length - 1].rate : null;
    };
    const generic = pick((r) => r.accountId === null && r.commodityId === null);
    const partyGeneric = useParty ? pick((r) => r.accountId === partyId && r.commodityId === null) : null;
    const commodityIds = new Set(mine.filter((r) => r.commodityId !== null).map((r) => r.commodityId as number));
    const byCommodity: Record<number, string> = {};
    for (const c of commodityIds) {
      const partyJins = useParty ? pick((r) => r.accountId === partyId && r.commodityId === c) : null;
      const jins = pick((r) => r.accountId === null && r.commodityId === c);
      const v = partyJins ?? partyGeneric ?? jins;
      if (v !== null) byCommodity[c] = v;
    }
    const g = partyGeneric ?? generic;
    if (g === null && Object.keys(byCommodity).length === 0) continue;
    out[h.id] = { generic: g, byCommodity };
  }
  return out;
}

export async function overrideMap(tx: DbOrTx, heads: HeadDef[]) {
  if (heads.length === 0) return new Map<number, boolean>();
  const rows = await tx
    .select({ id: chargeHeads.id, allow: chargeHeads.allowPartyOverride })
    .from(chargeHeads)
    .where(sql`${chargeHeads.id} IN (${sql.join(heads.map((h) => sql`${h.id}`), sql`, `)})`);
  return new Map(rows.map((r) => [r.id, r.allow]));
}

/** Heads + rates for one document (date, sale type, party). */
export async function rateContext(tx: DbOrTx, date: string, saleType: string, partyId: number | null) {
  const heads = await loadHeads(tx, date, saleType);
  const allow = await overrideMap(tx, heads);
  const rates = await resolveRates(tx, heads, date, partyId, allow);
  return { heads, rates };
}
