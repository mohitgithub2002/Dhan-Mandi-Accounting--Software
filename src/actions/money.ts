"use server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { parchis } from "@/db/schema";
import { runAction } from "@/lib/server/action";
import { requireActor, workingDate } from "@/lib/server/auth";
import { getAccount } from "@/lib/server/core";
import { ruleFor } from "@/lib/server/byaj";
import { balanceOf } from "@/lib/server/ledger";
import { parse, z, zDate, zId, zNum, zOptNum } from "@/lib/server/validate";
import { createContra, createPayment, createReceipt, openBills, raddVoucher } from "@/lib/server/vouchers";

/** Balance, open bills, pending parchis and byaj rule of a party, shown while entering money. */
export async function partyInfo(id: number) {
  const actor = await requireActor("jama_naam");
  const a = await getAccount(db, id);
  const wd = await workingDate(actor);
  const balance = (await balanceOf(db, id)).toFixed(2);
  const bills = a.partyType === "vyapari" || a.partyType === "agency" ? await openBills(db, id) : [];
  const recentParchis =
    a.partyType === "kisan"
      ? await db
          .select({ id: parchis.id, no: parchis.parchiNo, date: parchis.date, payable: parchis.payableAmount })
          .from(parchis)
          .where(and(eq(parchis.kisanId, id), eq(parchis.status, "active")))
          .orderBy(desc(parchis.date), desc(parchis.parchiNo))
          .limit(8)
      : [];
  const rule = await ruleFor(db, id, wd);
  return { id, partyType: a.partyType, balance, bills, recentParchis, byajRate: rule?.ratePm ?? null };
}

const modeSchema = z.enum(["cash", "cheque", "neft", "upi"]);

export async function receiptAction(input: unknown) {
  return runAction("jama_naam", async (tx, actor) => {
    const i = parse(
      z.object({
        date: zDate,
        partyId: zId,
        amount: zNum,
        mode: modeSchema,
        bankAccountId: zId.nullable().optional(),
        refNo: z.string().default(""),
        narration: z.string().default(""),
        tds194Q: zOptNum,
        tds194H: zOptNum,
        allocation: z.union([z.literal("auto"), z.array(z.object({ billId: zId, amount: zNum }))]).default("auto"),
      }),
      input,
    );
    const r = await createReceipt(tx, actor, i);
    return { data: { id: r.voucher.id, no: r.voucher.voucherNo }, warnings: r.warnings };
  });
}

export async function paymentAction(input: unknown) {
  return runAction("jama_naam", async (tx, actor) => {
    const i = parse(
      z.object({
        date: zDate,
        kind: z.enum(["naam", "peshgi", "kharcha"]),
        accountId: zId,
        amount: zNum,
        mode: modeSchema,
        bankAccountId: zId.nullable().optional(),
        refNo: z.string().default(""),
        narration: z.string().default(""),
        byajRatePm: zOptNum.nullable(),
      }),
      input,
    );
    const r = await createPayment(tx, actor, i);
    return { data: { id: r.voucher.id, no: r.voucher.voucherNo }, warnings: r.warnings };
  });
}

export async function contraAction(input: unknown) {
  return runAction("jama_naam", async (tx, actor) => {
    const i = parse(
      z.object({ date: zDate, fromAccountId: zId, toAccountId: zId, amount: zNum, refNo: z.string().default(""), narration: z.string().default("") }),
      input,
    );
    const r = await createContra(tx, actor, i);
    return { data: { id: r.voucher.id, no: r.voucher.voucherNo }, warnings: r.warnings };
  });
}

export async function raddVoucherAction(input: { id: number; reason: string }) {
  return runAction("radd", async (tx, actor) => {
    const i = parse(z.object({ id: zId, reason: z.string() }), input);
    await raddVoucher(tx, actor, i.id, i.reason);
    return true;
  });
}

export async function cashAccountId() {
  await requireActor();
  const rows = await db.execute<{ id: number }>(sql`SELECT id FROM accounts WHERE code = 'CASH'`);
  return Number(rows[0].id);
}
