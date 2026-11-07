import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, backupsLog, commodities } from "@/db/schema";

export type Commodity = { id: number; code: string; nameHi: string; nameEn: string; weighMode: string; defaultTareKg: string; defaultMoisturePct: string; bagKg: string };

export async function listCommodities(onlyActive = true): Promise<Commodity[]> {
  return db
    .select({
      id: commodities.id,
      code: commodities.code,
      nameHi: commodities.nameHi,
      nameEn: commodities.nameEn,
      weighMode: commodities.weighMode,
      defaultTareKg: commodities.defaultTareKg,
      defaultMoisturePct: commodities.defaultMoisturePct,
      bagKg: commodities.bagKg,
    })
    .from(commodities)
    .where(onlyActive ? eq(commodities.active, true) : undefined)
    .orderBy(asc(commodities.seq), asc(commodities.id));
}

export async function listAccountsByType(types: string[]) {
  return db
    .select({ id: accounts.id, code: accounts.code, nameHi: accounts.nameHi, nameEn: accounts.nameEn, partyType: accounts.partyType })
    .from(accounts)
    .where(and(inArray(accounts.partyType, types), eq(accounts.active, true)))
    .orderBy(asc(accounts.nameHi));
}

/** Aaj ka saar (PRD §7): today's totals for the home screen. */
export async function todaySummary(date: string) {
  const [counts] = await db.execute<{
    arrivals: number;
    lots: number;
    pending_boli: number;
    pending_tulai: number;
    pending_parchi: number;
    pending_bill: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM arrivals WHERE date = ${date}) AS arrivals,
      (SELECT COUNT(*)::int FROM lots WHERE date = ${date}) AS lots,
      (SELECT COUNT(*)::int FROM lots WHERE date = ${date} AND status = 'aamad') AS pending_boli,
      (SELECT COUNT(*)::int FROM lots WHERE date = ${date} AND status = 'boli') AS pending_tulai,
      (SELECT COUNT(*)::int FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id
         WHERE l.date = ${date} AND ls.net_kg > 0 AND ls.bhav IS NOT NULL AND ls.vyapari_id IS NOT NULL AND ls.parchi_id IS NULL) AS pending_parchi,
      (SELECT COUNT(*)::int FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id
         WHERE l.date = ${date} AND ls.net_kg > 0 AND ls.bhav IS NOT NULL AND ls.vyapari_id IS NOT NULL AND ls.bill_id IS NULL) AS pending_bill`);

  const byJins = await db.execute<{ name_hi: string; name_en: string; sales: number; kg: string; amount: string }>(sql`
    SELECT c.name_hi, c.name_en, COUNT(*)::int AS sales, SUM(ls.net_kg) AS kg, SUM(ls.amount) AS amount
    FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id JOIN commodities c ON c.id = l.commodity_id
    WHERE l.date = ${date} AND ls.net_kg > 0 AND ls.bhav IS NOT NULL
    GROUP BY c.id ORDER BY c.seq`);

  const [docs] = await db.execute<{ parchis: number; parchi_total: string; bills: number; bill_total: string }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM parchis WHERE date = ${date} AND status = 'active') AS parchis,
      (SELECT COALESCE(SUM(net_amount), 0) FROM parchis WHERE date = ${date} AND status = 'active') AS parchi_total,
      (SELECT COUNT(*)::int FROM bills WHERE date = ${date} AND status = 'active') AS bills,
      (SELECT COALESCE(SUM(total), 0) FROM bills WHERE date = ${date} AND status = 'active') AS bill_total`);

  const money = await db.execute<{ kind: string; inflow: string; outflow: string }>(sql`
    SELECT CASE WHEN a.code = 'CASH' THEN 'cash' ELSE 'bank' END AS kind,
      COALESCE(SUM(le.debit), 0) AS inflow, COALESCE(SUM(le.credit), 0) AS outflow
    FROM ledger_entries le JOIN accounts a ON a.id = le.account_id
    WHERE le.date = ${date} AND (a.code = 'CASH' OR a.party_type = 'bank')
    GROUP BY 1`);

  return { counts, byJins: [...byJins], docs, money: [...money] };
}

export async function lastBackup() {
  const [row] = await db.select().from(backupsLog).orderBy(sql`${backupsLog.at} DESC`).limit(1);
  return row ?? null;
}

export interface DayLot {
  lotId: number;
  arrivalId: number;
  arrivalNo: number;
  gateEntryNo: string;
  vehicleNo: string;
  kisanId: number;
  kisanHi: string;
  kisanEn: string;
  village: string;
  commodityId: number;
  jinsHi: string;
  jinsEn: string;
  bags: number;
  status: string;
  sales: {
    id: number;
    vyapariId: number | null;
    vyapariHi: string | null;
    vyapariEn: string | null;
    vyapariType: string | null;
    village: string | null;
    saleType: string;
    bhav: string | null;
    bags: number;
    weighMode: string;
    grossKg: string;
    tarePerBagKg: string;
    moisturePct: string;
    dustKg: string;
    netKg: string;
    amount: string;
    parchiId: number | null;
    billId: number | null;
    bagKgs: string[];
  }[];
}

/** All dheris of a day with their sale lines (aamad list, boli and tulai sheets). */
export async function lotsForDate(date: string): Promise<DayLot[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT l.id AS lot_id, a.id AS arrival_id, a.arrival_no, a.gate_entry_no, a.vehicle_no,
      l.kisan_id, k.name_hi AS kisan_hi, k.name_en AS kisan_en, k.village,
      l.commodity_id, c.name_hi AS jins_hi, c.name_en AS jins_en, l.bags, l.status,
      COALESCE(json_agg(json_build_object(
        'id', ls.id, 'vyapariId', ls.vyapari_id, 'vyapariHi', v.name_hi, 'vyapariEn', v.name_en, 'vyapariType', v.party_type,
        'village', v.village, 'saleType', ls.sale_type, 'bhav', ls.bhav, 'bags', ls.bags, 'weighMode', ls.weigh_mode,
        'grossKg', ls.gross_kg, 'tarePerBagKg', ls.tare_per_bag_kg, 'moisturePct', ls.moisture_pct, 'dustKg', ls.dust_kg,
        'netKg', ls.net_kg, 'amount', ls.amount, 'parchiId', ls.parchi_id, 'billId', ls.bill_id,
        'bagKgs', COALESCE((SELECT json_agg(bw.kg::text ORDER BY bw.bag_no) FROM lot_bag_weights bw WHERE bw.lot_sale_id = ls.id), '[]'::json)
      ) ORDER BY ls.id) FILTER (WHERE ls.id IS NOT NULL), '[]') AS sales
    FROM lots l
    JOIN arrivals a ON a.id = l.arrival_id
    JOIN accounts k ON k.id = l.kisan_id
    JOIN commodities c ON c.id = l.commodity_id
    LEFT JOIN lot_sales ls ON ls.lot_id = l.id
    LEFT JOIN accounts v ON v.id = ls.vyapari_id
    WHERE l.date = ${date}
    GROUP BY l.id, a.id, k.id, c.id
    ORDER BY l.id`);
  return rows.map((r) => ({
    lotId: Number(r.lot_id),
    arrivalId: Number(r.arrival_id),
    arrivalNo: Number(r.arrival_no),
    gateEntryNo: String(r.gate_entry_no ?? ""),
    vehicleNo: String(r.vehicle_no ?? ""),
    kisanId: Number(r.kisan_id),
    kisanHi: String(r.kisan_hi ?? ""),
    kisanEn: String(r.kisan_en ?? ""),
    village: String(r.village ?? ""),
    commodityId: Number(r.commodity_id),
    jinsHi: String(r.jins_hi),
    jinsEn: String(r.jins_en),
    bags: Number(r.bags),
    status: String(r.status),
    sales: (r.sales as DayLot["sales"]).map((s) => ({
      ...s,
      bhav: s.bhav === null ? null : String(s.bhav),
      grossKg: String(s.grossKg),
      tarePerBagKg: String(s.tarePerBagKg),
      moisturePct: String(s.moisturePct),
      dustKg: String(s.dustKg),
      netKg: String(s.netKg),
      amount: String(s.amount),
    })),
  }));
}

/** Day's average private bhav per jins with the ±% warning band (PRD §5.3). */
export async function bhavBands(date: string, pct: string) {
  const rows = await db.execute<{ commodity_id: number; avg: string }>(sql`
    SELECT l.commodity_id, AVG(ls.bhav)::numeric(14,2) AS avg
    FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id
    WHERE l.date = ${date} AND ls.bhav IS NOT NULL AND ls.sale_type = 'private'
    GROUP BY l.commodity_id`);
  const p = Number(pct) / 100;
  return Object.fromEntries(
    rows.map((r) => [Number(r.commodity_id), { avg: r.avg, low: (Number(r.avg) * (1 - p)).toFixed(2), high: (Number(r.avg) * (1 + p)).toFixed(2) }]),
  ) as Record<number, { avg: string; low: string; high: string }>;
}

export async function parchiList(from: string, to: string) {
  return db.execute<{ id: number; parchi_no: number; date: string; name_hi: string; name_en: string; village: string; sale_type: string; gross_amount: string; deductions: string; net_amount: string; peshgi_recovered: string; payable_amount: string; status: string; print_count: number }>(sql`
    SELECT p.id, p.parchi_no, p.date::text AS date, a.name_hi, a.name_en, a.village, p.sale_type, p.gross_amount, p.deductions,
      p.net_amount, p.peshgi_recovered, p.payable_amount, p.status, p.print_count
    FROM parchis p JOIN accounts a ON a.id = p.kisan_id
    WHERE p.date BETWEEN ${from} AND ${to}
    ORDER BY p.date, p.parchi_no`);
}

export async function billList(from: string, to: string) {
  return db.execute<{ id: number; bill_no: number; date: string; name_hi: string; name_en: string; licence_no: string; sale_type: string; amount: string; charges: string; total: string; due_date: string | null; status: string; print_count: number; allocated: string }>(sql`
    SELECT b.id, b.bill_no, b.date::text AS date, a.name_hi, a.name_en, a.licence_no, b.sale_type, b.amount, b.charges, b.total,
      b.due_date::text AS due_date, b.status, b.print_count,
      COALESCE((SELECT SUM(x.amount) FROM bill_allocations x WHERE x.bill_id = b.id), 0) AS allocated
    FROM bills b JOIN accounts a ON a.id = b.vyapari_id
    WHERE b.date BETWEEN ${from} AND ${to}
    ORDER BY b.date, b.bill_no`);
}

export async function salesForEdit(ids: number[]) {
  if (!ids.length) return {};
  const { lotSales } = await import("@/db/schema");
  const rows = await db.select().from(lotSales).where(inArray(lotSales.id, ids));
  return Object.fromEntries(
    rows.map((s) => [
      s.id,
      { id: s.id, bhav: s.bhav ?? "0", bags: s.bags, weighMode: s.weighMode, grossKg: s.grossKg, tarePerBagKg: s.tarePerBagKg, moisturePct: s.moisturePct, dustKg: s.dustKg },
    ]),
  );
}

/** Vouchers of a day (jama / naam lists, nakal). */
export async function vouchersFor(from: string, to: string, types?: string[]) {
  return db.execute<{ id: number; type: string; voucher_no: number; date: string; narration: string; mode: string; ref_no: string; amount: string; status: string; party_hi: string | null; party_en: string | null; party_id: number | null; doc_type: string | null; doc_id: number | null; reverses_id: number | null; created_at: Date; user_name: string | null }>(sql`
    SELECT v.id, v.type, v.voucher_no, v.date::text AS date, v.narration, v.mode, v.ref_no, v.amount, v.status,
      a.name_hi AS party_hi, a.name_en AS party_en, v.party_id, v.doc_type, v.doc_id, v.reverses_id, v.created_at, u.name AS user_name
    FROM vouchers v
    LEFT JOIN accounts a ON a.id = v.party_id
    LEFT JOIN users u ON u.id = v.created_by
    WHERE v.date BETWEEN ${from} AND ${to}
      ${types?.length ? sql`AND v.type IN (${sql.join(types.map((t) => sql`${t}`), sql`, `)})` : sql``}
    ORDER BY v.date, v.created_at, v.id`);
}
