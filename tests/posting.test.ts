/**
 * Integration tests of the posting service against a real PostgreSQL database.
 * Requires TEST_DATABASE_URL (the database is wiped). Skipped when it is not set.
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createDb, type DB } from "@/db";
import * as s from "@/db/schema";
import { seed } from "@/db/seed";
import { runMigrations } from "../scripts/migrate";
import { errorText } from "@/lib/server/errors";
import { clearSystemAccountCache, systemAccount, type Actor } from "@/lib/server/core";
import { balanceOf } from "@/lib/server/ledger";
import { createArrival, saveBoli, saveTulai } from "@/lib/server/sales";
import { editSaleAndRepost, makeBills, makeParchis, raddBill, raddParchi } from "@/lib/server/documents";
import { createContra, createPayment, createReceipt, openBills } from "@/lib/server/vouchers";
import { postByaj, previewByaj } from "@/lib/server/byaj";
import { closeDay, reopenDay } from "@/lib/server/dayclose";

const url = process.env.TEST_DATABASE_URL;
const DAY = "2026-11-07";
const malik: Actor = { id: 1, role: "malik", name: "M", lang: "en" };
const munim: Actor = { id: 2, role: "munim", name: "Mu", lang: "en" };
const operator: Actor = { id: 3, role: "operator", name: "O", lang: "en" };

let db: DB;
let client: postgres.Sql;
const ids: Record<string, number> = {};

async function party(nameEn: string) {
  const [a] = await db.select().from(s.accounts).where(eq(s.accounts.nameEn, nameEn));
  return a.id;
}
const bal = async (id: number) => (await balanceOf(db, id)).toFixed(2);

async function sellLot(kisan: number, vyapari: number, bags: number, grossKg: string, bhav: string, date = DAY) {
  return db.transaction(async (tx) => {
    const a = await createArrival(tx, operator, { date, kisanId: kisan, lots: [{ commodityId: ids.wheat, bags }] });
    await saveBoli(tx, operator, a.lotIds[0], [{ vyapariId: vyapari, bhav, bags }]);
    await saveTulai(tx, operator, a.saleIds[0], { grossKg, bags, tarePerBagKg: 0 });
    return a;
  });
}

describe.skipIf(!url)("posting service (PostgreSQL)", () => {
  beforeAll(async () => {
    const admin = postgres(url!, { max: 1, onnotice: () => {} });
    await admin.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await admin.end();
    await runMigrations(url!);
    ({ client, db } = createDb(url!));
    clearSystemAccountCache();
    await seed(db, { demo: true });
    // actors must exist as users for FK columns
    await db.execute(sql`UPDATE users SET id = id`);
    ids.wheat = (await db.select().from(s.commodities).where(eq(s.commodities.code, "GEHUN")))[0].id;
    ids.ramesh = await party("Ramesh Kumar");
    ids.suresh = await party("Suresh Singh");
    ids.agarwal = await party("Agarwal Traders");
    ids.goyal = await party("Goyal & Sons");
    ids.sbi = await party("SBI Current A/c");
    ids.clearing = await systemAccount(db, "SALE_CLEARING");
    ids.arhat = await systemAccount(db, "ARHAT_INCOME");
    ids.samiti = await systemAccount(db, "MANDI_SAMITI");
    ids.cash = await systemAccount(db, "CASH");
  });

  afterAll(async () => {
    await client?.end();
  });

  it("PRD worked example: dheri → parchi 1,22,475 and bill 1,27,216, books balance", async () => {
    await sellLot(ids.ramesh, ids.agarwal, 100, "5000", "2450");
    const [p] = await db.transaction((tx) => makeParchis(tx, operator, { date: DAY }));
    const [b] = await db.transaction((tx) => makeBills(tx, operator, { date: DAY }));
    expect(p.parchiNo).toBe(1);
    expect(p.netAmount).toBe("122475.00");
    expect(b.billNo).toBe(1);
    expect(b.total).toBe("127216.00");
    expect(b.dueDate).toBe("2026-11-22"); // 15 credit days

    expect(await bal(ids.ramesh)).toBe("-122475.00"); // jama
    expect(await bal(ids.agarwal)).toBe("127216.00"); // naam
    expect(await bal(ids.clearing)).toBe("0.00");
    expect(await bal(ids.arhat)).toBe("-2450.00");
    expect(await bal(ids.samiti)).toBe("-1960.00");

    const charges = await db.select().from(s.documentCharges).where(eq(s.documentCharges.docType, "bill"));
    expect(charges.map((c) => [c.code, c.amount])).toEqual([
      ["ARHAT", "2450.00"],
      ["TULAI", "306.00"],
      ["MANDI_SHULK", "1960.00"],
    ]);
  });

  it("every voucher balances and the trial balance is zero", async () => {
    const rows = await db.execute<{ id: number }>(sql`
      SELECT voucher_id AS id FROM ledger_entries GROUP BY voucher_id HAVING SUM(debit) <> SUM(credit)`);
    expect(rows.length).toBe(0);
    const [tb] = await db.execute<{ d: string; c: string }>(sql`SELECT SUM(debit) d, SUM(credit) c FROM ledger_entries`);
    expect(tb.d).toBe(tb.c);
  });

  it("receipt with TDS settles the bill oldest-first", async () => {
    const r = await db.transaction((tx) =>
      createReceipt(tx, munim, { date: DAY, partyId: ids.agarwal, amount: "127000", tds194Q: "216", mode: "neft", bankAccountId: ids.sbi, refNo: "UTR1" }),
    );
    expect(r.warnings).toEqual([]);
    expect(await bal(ids.agarwal)).toBe("0.00");
    expect(await openBills(db, ids.agarwal)).toEqual([]);
    const tds = await db.select().from(s.tdsEntries);
    expect(tds[0]).toMatchObject({ section: "194Q", amount: "216.00", quarter: "2026-27 Q3" });
  });

  it("operator cannot enter receipts; cash above limit warns", async () => {
    await expect(
      db.transaction((tx) => createReceipt(tx, operator, { date: DAY, partyId: ids.agarwal, amount: "1", mode: "cash" })),
    ).rejects.toThrow(/cannot enter receipts/);
    const res = await db.transaction((tx) =>
      createPayment(tx, munim, { date: DAY, kind: "naam", accountId: ids.ramesh, amount: "50000", mode: "cash" }),
    );
    expect(res.warnings.length).toBe(1);
    expect(await bal(ids.ramesh)).toBe("-72475.00");
    await db.transaction((tx) => createContra(tx, munim, { date: DAY, fromAccountId: ids.sbi, toAccountId: ids.cash, amount: "60000" }));
    expect(await bal(ids.cash)).toBe("10000.00");
  });

  it("peshgi with byaj: ₹10,000 at 1% for 30 days = ₹100, posted once", async () => {
    await db.transaction((tx) =>
      createPayment(tx, munim, { date: "2026-05-01", kind: "peshgi", accountId: ids.suresh, amount: "10000", mode: "cash", byajRatePm: "1" }),
    );
    const preview = await previewByaj(db, { from: "2026-05-01", to: "2026-05-30", partyType: "kisan" });
    const line = preview.find((l) => l.accountId === ids.suresh)!;
    expect(line.amount).toBe("100.00");
    await db.transaction((tx) => postByaj(tx, munim, { from: "2026-05-01", to: "2026-05-30", accountIds: [ids.suresh] }));
    expect(await bal(ids.suresh)).toBe("10100.00");
    const again = await previewByaj(db, { from: "2026-05-01", to: "2026-05-30", accountIds: [ids.suresh] });
    expect(again).toEqual([]);
  });

  it("radd keeps the number, reverses the posting, and the next parchi is gapless", async () => {
    const [p1] = await db.select().from(s.parchis).where(eq(s.parchis.parchiNo, 1));
    await expect(db.transaction((tx) => raddParchi(tx, munim, p1.id, "galti"))).rejects.toThrow(/Only the malik/);
    await db.transaction((tx) => raddParchi(tx, malik, p1.id, "wrong kisan"));
    const [after] = await db.select().from(s.parchis).where(eq(s.parchis.id, p1.id));
    expect(after.status).toBe("radd");
    expect(after.parchiNo).toBe(1);
    expect(await bal(ids.ramesh)).toBe("50000.00"); // only the payment remains
    expect(await bal(ids.clearing)).toBe("-122500.00"); // billed, no parchi

    const [p2] = await db.transaction((tx) => makeParchis(tx, operator, { date: DAY }));
    expect(p2.parchiNo).toBe(2);
    expect(await bal(ids.clearing)).toBe("0.00");
  });

  it("editing a printed sale needs munim + reason and re-posts both documents with the same numbers", async () => {
    const [sale] = await db.select().from(s.lotSales).where(sql`${s.lotSales.parchiId} IS NOT NULL`);
    await db.update(s.parchis).set({ printCount: 1 }).where(eq(s.parchis.id, sale.parchiId!));
    await expect(db.transaction((tx) => editSaleAndRepost(tx, operator, sale.id, { bhav: "2500" }, "x"))).rejects.toThrow(/Only malik or munim/);
    await expect(db.transaction((tx) => editSaleAndRepost(tx, munim, sale.id, { bhav: "2500" }, " "))).rejects.toThrow(/reason/);
    await db.transaction((tx) => editSaleAndRepost(tx, munim, sale.id, { bhav: "2500" }, "bhav galat"));
    const [p] = await db.select().from(s.parchis).where(eq(s.parchis.id, sale.parchiId!));
    const [b] = await db.select().from(s.bills).where(eq(s.bills.id, sale.billId!));
    expect(p.parchiNo).toBe(2);
    expect(p.grossAmount).toBe("125000.00");
    expect(p.netAmount).toBe("124975.00");
    expect(b.billNo).toBe(1);
    // 125000 + 2500 + 312.50→313 + 2000
    expect(b.total).toBe("129813.00");
    expect(await bal(ids.clearing)).toBe("0.00");
    const audits = await db.select().from(s.auditLog).where(and(eq(s.auditLog.tableName, "lot_sales"), eq(s.auditLog.action, "edit")));
    expect(audits[0].reason).toBe("bhav galat");
  });

  it("split boli across two vyaparis makes two bills and one parchi", async () => {
    const day = "2026-11-08";
    await db.transaction(async (tx) => {
      const a = await createArrival(tx, operator, { date: day, kisanId: ids.suresh, lots: [{ commodityId: ids.wheat, bags: 60 }] });
      await saveBoli(tx, operator, a.lotIds[0], [
        { vyapariId: ids.agarwal, bhav: "2400", bags: 40 },
        { vyapariId: ids.goyal, bhav: "2410", bags: 20 },
      ]);
      const sales = await tx.select().from(s.lotSales).where(eq(s.lotSales.lotId, a.lotIds[0]));
      expect(sales).toHaveLength(2);
      for (const sl of sales) await saveTulai(tx, operator, sl.id, { grossKg: sl.bags === 40 ? "2000" : "1000" });
    });
    const ps = await db.transaction((tx) => makeParchis(tx, operator, { date: day }));
    const bs = await db.transaction((tx) => makeBills(tx, operator, { date: day }));
    expect(ps).toHaveLength(1);
    expect(bs).toHaveLength(2);
    expect(ps[0].grossAmount).toBe("72100.00"); // 20×2400 + 10×2410
    expect(await bal(ids.clearing)).toBe("0.00");
    // bill radd releases the sales for a new bill
    await db.transaction((tx) => raddBill(tx, malik, bs[1].id, "test"));
    expect(await bal(ids.clearing)).not.toBe("0.00");
    const again = await db.transaction((tx) => makeBills(tx, operator, { date: day }));
    expect(again[0].billNo).toBe(4);
    expect(await bal(ids.clearing)).toBe("0.00");
  });

  it("din band blocks entries until the malik reopens with a reason", async () => {
    await db.transaction((tx) => closeDay(tx, munim, DAY));
    await expect(
      db.transaction((tx) => createPayment(tx, munim, { date: DAY, kind: "naam", accountId: ids.ramesh, amount: "1", mode: "cash" })),
    ).rejects.toThrow(/closed/);
    await expect(db.transaction((tx) => reopenDay(tx, munim, DAY, "x"))).rejects.toThrow(/Only the malik/);
    await db.transaction((tx) => reopenDay(tx, malik, DAY, "late cash entry"));
    await db.transaction((tx) => createPayment(tx, munim, { date: DAY, kind: "naam", accountId: ids.ramesh, amount: "1", mode: "cash" }));
  });

  it("database rejects an unbalanced voucher and edits to posted lines", async () => {
    const rejectText = (pr: Promise<unknown>) => pr.then(() => "resolved", (e) => errorText(e));
    expect(
      await rejectText(db.transaction(async (tx) => {
        const [v] = await tx
          .insert(s.vouchers)
          .values({ type: "journal", voucherNo: 999, fyId: 1, date: DAY, amount: "10" })
          .returning();
        await tx.insert(s.ledgerEntries).values({ voucherId: v.id, accountId: ids.cash, date: DAY, debit: "10" });
        await tx.insert(s.ledgerEntries).values({ voucherId: v.id, accountId: ids.arhat, date: DAY, credit: "9" });
      })),
    ).toMatch(/not balanced/);
    expect(await rejectText(db.execute(sql`UPDATE ledger_entries SET debit = debit + 1 WHERE id = 1`))).toMatch(/cannot be changed/);
    expect(await rejectText(db.execute(sql`DELETE FROM audit_log`))).toMatch(/cannot be changed/);
  });

  it("party override: a vyapari with arhat 1.75%", async () => {
    const [arhat] = await db.select().from(s.chargeHeads).where(eq(s.chargeHeads.code, "ARHAT"));
    await db.insert(s.chargeRates).values({ chargeHeadId: arhat.id, accountId: ids.goyal, rate: "1.75", effectiveFrom: "2026-11-01" });
    const day = "2026-11-09";
    await sellLot(ids.ramesh, ids.goyal, 100, "5000", "2450", day);
    const [b] = await db.transaction((tx) => makeBills(tx, operator, { date: day }));
    const lines = await db.select().from(s.documentCharges).where(and(eq(s.documentCharges.docType, "bill"), eq(s.documentCharges.docId, b.id)));
    expect(lines.find((l) => l.code === "ARHAT")?.amount).toBe("2143.75");
  });
});
