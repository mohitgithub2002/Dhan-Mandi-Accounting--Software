"use server";
import { and, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accountGroups, accounts, chargeHeads, chargeRates, commodities, documentCharges, interestRules } from "@/db/schema";
import { FEE_GROUP_RATE } from "@/db/seed";
import { addDaysIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { runAction } from "@/lib/server/action";
import { requireActor } from "@/lib/server/auth";
import { audit } from "@/lib/server/core";
import { errorText, fail } from "@/lib/server/errors";
import { parse, z, zDate, zId, zNum } from "@/lib/server/validate";

const GROUP_FOR: Record<string, string> = {
  kisan: "KISAN",
  vyapari: "VYAPARI",
  agency: "AGENCY",
  labour: "LABOUR",
  transporter: "TRANSPORTER",
  bank: "BANK",
  expense: "EXPENSE",
  income: "INCOME",
  payable: "DUTIES",
  other: "CURRENT_ASSETS",
};


const partySchema = z.object({
  id: zId.optional(),
  partyType: z.enum(["kisan", "vyapari", "agency", "labour", "transporter", "bank", "expense", "income", "payable", "other"]),
  nameHi: z.string().trim().default(""),
  nameEn: z.string().trim().default(""),
  fatherName: z.string().trim().default(""),
  village: z.string().trim().default(""),
  tehsil: z.string().trim().default(""),
  mobile: z.string().trim().default(""),
  pan: z.string().trim().toUpperCase().default(""),
  aadhaarLast4: z.string().trim().default(""),
  bankName: z.string().trim().default(""),
  bankAc: z.string().trim().default(""),
  ifsc: z.string().trim().toUpperCase().default(""),
  gstin: z.string().trim().toUpperCase().default(""),
  licenceNo: z.string().trim().default(""),
  openingAmount: zNum.default("0"),
  openingSide: z.enum(["jama", "naam"]).default("jama"),
  creditDays: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

/** Party (khata) master save (PRD §5.1). Parties are never deleted, only made inactive. */
export async function saveParty(input: unknown) {
  return runAction("party_edit", async (tx, actor) => {
    const i = parse(partySchema, input);
    if (!i.nameHi && !i.nameEn) fail("नाम डालें", "Enter the name");
    if (i.mobile && !/^\d{10}$/.test(i.mobile)) fail("मोबाइल 10 अंक का हो", "Mobile must be 10 digits");
    if (i.aadhaarLast4 && !/^\d{4}$/.test(i.aadhaarLast4)) fail("आधार के केवल आख़िरी 4 अंक", "Only the last 4 digits of Aadhaar");
    if (i.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(i.pan)) fail("PAN ग़लत है", "PAN looks wrong");
    if (i.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(i.ifsc)) fail("IFSC ग़लत है", "IFSC looks wrong");
    const [g] = await tx.select().from(accountGroups).where(eq(accountGroups.code, GROUP_FOR[i.partyType]));
    const { id, ...values } = i;
    try {
      if (id) {
        const [old] = await tx.select().from(accounts).where(eq(accounts.id, id));
        if (!old) fail("खाता नहीं मिला", "Account not found");
        if (old.isSystem && old.partyType !== values.partyType) fail("सिस्टम खाते का प्रकार नहीं बदलता", "System account type cannot change");
        await tx.update(accounts).set({ ...values, groupId: old.isSystem ? old.groupId : g.id }).where(eq(accounts.id, id));
        await audit(tx, actor, { table: "accounts", rowId: id, action: "edit", oldData: old, newData: values });
        return { id };
      }
      const [row] = await tx.insert(accounts).values({ ...values, groupId: g.id }).returning();
      await audit(tx, actor, { table: "accounts", rowId: row.id, action: "create", newData: row });
      return { id: row.id };
    } catch (e) {
      if (/accounts_mobile_per_type/.test(errorText(e))) fail("यह मोबाइल इस प्रकार के दूसरे खाते में है", "This mobile is already used by another party of this type");
      throw e;
    }
  });
}

/** Duplicate-name warning: same name and gaon (PRD §5.1). */
export async function findDuplicates(input: { name: string; village: string; excludeId?: number }) {
  await requireActor();
  const name = input.name.trim();
  if (!name) return [];
  const rows = await db
    .select({ id: accounts.id, nameHi: accounts.nameHi, nameEn: accounts.nameEn, village: accounts.village, partyType: accounts.partyType })
    .from(accounts)
    .where(
      and(
        or(sql`lower(${accounts.nameHi}) = lower(${name})`, sql`lower(${accounts.nameEn}) = lower(${name})`),
        input.village.trim() ? sql`lower(${accounts.village}) = lower(${input.village.trim()})` : undefined,
        input.excludeId ? ne(accounts.id, input.excludeId) : undefined,
      ),
    )
    .limit(5);
  return rows;
}

/** Byaj rule per party: rate % per month, method, grace days (PRD §5.10). */
export async function saveInterestRule(input: unknown) {
  return runAction("party_edit", async (tx, actor) => {
    const i = parse(
      z.object({
        accountId: zId,
        ratePm: zNum,
        method: z.enum(["simple", "monthly", "compound"]),
        graceDays: z.coerce.number().int().min(0).default(0),
        overdueOnly: z.boolean().default(false),
        effectiveFrom: zDate,
      }),
      input,
    );
    await tx.update(interestRules).set({ active: false }).where(and(eq(interestRules.accountId, i.accountId), gte(interestRules.effectiveFrom, i.effectiveFrom)));
    const [row] = await tx.insert(interestRules).values({ ...i, ratePm: Number(i.ratePm).toFixed(4) }).returning();
    await audit(tx, actor, { table: "interest_rules", rowId: row.id, action: "rate_change", newData: row });
    return { id: row.id };
  });
}

export async function stopInterest(input: { accountId: number }) {
  return runAction("party_edit", async (tx, actor) => {
    const i = parse(z.object({ accountId: zId }), input);
    await tx.update(interestRules).set({ active: false }).where(eq(interestRules.accountId, i.accountId));
    await audit(tx, actor, { table: "interest_rules", rowId: i.accountId, action: "rate_change", newData: { stopped: true } });
    return true;
  });
}

/* --------------------------------------------------------------- jins */

export async function saveJins(input: unknown) {
  return runAction("jins_master", async (tx, actor) => {
    const i = parse(
      z.object({
        id: zId.optional(),
        code: z.string().trim().toUpperCase().min(1),
        nameHi: z.string().trim().min(1),
        nameEn: z.string().trim().min(1),
        hsn: z.string().trim().default(""),
        unit: z.string().default("qtl"),
        feeGroup: z.enum(["A", "B", "C"]),
        bagKg: zNum,
        defaultTareKg: zNum,
        defaultMoisturePct: zNum,
        weighMode: z.enum(["total", "bagwise"]),
        mspRate: zNum.nullable().optional(),
        mspSeason: z.string().default(""),
        seq: z.coerce.number().int().default(0),
        active: z.boolean().default(true),
      }),
      input,
    );
    const { id, ...v } = i;
    const values = { ...v, mspRate: v.mspRate && Number(v.mspRate) ? v.mspRate : null };
    if (id) {
      const [old] = await tx.select().from(commodities).where(eq(commodities.id, id));
      await tx.update(commodities).set(values).where(eq(commodities.id, id));
      await audit(tx, actor, { table: "commodities", rowId: id, action: "edit", oldData: old, newData: values });
      return { id };
    }
    const [row] = await tx.insert(commodities).values(values).returning();
    // A new jins gets its mandi shulk rate from its fee group, effective today.
    const [ms] = await tx.select().from(chargeHeads).where(eq(chargeHeads.code, "MANDI_SHULK"));
    if (ms) {
      await tx.insert(chargeRates).values({ chargeHeadId: ms.id, commodityId: row.id, rate: FEE_GROUP_RATE[row.feeGroup] ?? "1.6", effectiveFrom: new Date().toISOString().slice(0, 10), createdBy: actor.id });
    }
    await audit(tx, actor, { table: "commodities", rowId: row.id, action: "create", newData: row });
    return { id: row.id };
  });
}

/* --------------------------------------------------- kharcha / tax master */

const headSchema = z.object({
  id: zId.optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/),
  nameHi: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  kind: z.enum(["kharcha", "shulk", "katauti", "gst"]),
  basis: z.enum(["pct_amount", "per_qtl", "per_bag", "fixed_doc", "pct_of_line"]),
  refHeadId: zId.nullable().optional(),
  payer: z.enum(["kisan", "vyapari", "split"]),
  splitKisanPct: zNum.default("50"),
  saleType: z.enum(["private", "sarkari", "both"]),
  allowPartyOverride: z.boolean().default(true),
  postMode: z.enum(["income", "payable", "show"]),
  postAccountId: zId.nullable().optional(),
  seq: z.coerce.number().int(),
  rounding: z.enum(["none", "nearest_1", "nearest_0_10", "up_1"]),
  onParchi: z.boolean(),
  onBill: z.boolean(),
  printLabelHi: z.string().default(""),
  printLabelEn: z.string().default(""),
  activeFrom: zDate,
});

/** Add or edit a kharcha line. Rates live in charge_rates with history (PRD §6). */
export async function saveChargeHead(input: unknown) {
  return runAction("rate_master", async (tx, actor) => {
    const i = parse(headSchema, input);
    if (i.basis === "pct_of_line" && !i.refHeadId) fail("किस खर्चे का % — चुनें", "Choose the line this % applies to");
    if (i.postMode !== "show" && !i.postAccountId) fail("किस खाते में जाएगा — चुनें", "Choose the account it posts to");
    const { id, ...v } = i;
    const values = { ...v, refHeadId: v.basis === "pct_of_line" ? (v.refHeadId ?? null) : null, postAccountId: v.postMode === "show" ? null : (v.postAccountId ?? null) };
    if (id) {
      if (values.refHeadId === id) fail("खुद का % नहीं हो सकता", "A line cannot refer to itself");
      const [old] = await tx.select().from(chargeHeads).where(eq(chargeHeads.id, id));
      await tx.update(chargeHeads).set(values).where(eq(chargeHeads.id, id));
      await audit(tx, actor, { table: "charge_heads", rowId: id, action: "edit", oldData: old, newData: values });
      return { id };
    }
    const [row] = await tx.insert(chargeHeads).values(values).returning();
    await audit(tx, actor, { table: "charge_heads", rowId: row.id, action: "create", newData: row });
    return { id: row.id };
  });
}

/**
 * New rate version from a date (PRD §6 "Modify rate"). The previous open rate of
 * the same scope (jins / party) is closed the day before; history is kept.
 */
export async function addChargeRate(input: unknown) {
  return runAction("rate_master", async (tx, actor) => {
    const i = parse(
      z.object({ chargeHeadId: zId, commodityId: zId.nullable().optional(), accountId: zId.nullable().optional(), rate: zNum, effectiveFrom: zDate }),
      input,
    );
    if (Number(i.rate) < 0) fail("दर ग़लत है", "Rate cannot be negative");
    const scope = and(
      eq(chargeRates.chargeHeadId, i.chargeHeadId),
      i.commodityId ? eq(chargeRates.commodityId, i.commodityId) : isNull(chargeRates.commodityId),
      i.accountId ? eq(chargeRates.accountId, i.accountId) : isNull(chargeRates.accountId),
    );
    const later = await tx.select().from(chargeRates).where(and(scope, gte(chargeRates.effectiveFrom, i.effectiveFrom)));
    if (later.length) fail("इस तारीख़ या बाद की दर पहले से है", "A rate from this date or later already exists");
    const prev = await tx.select().from(chargeRates).where(and(scope, lt(chargeRates.effectiveFrom, i.effectiveFrom), or(isNull(chargeRates.effectiveTo), gte(chargeRates.effectiveTo, i.effectiveFrom))));
    for (const p of prev) await tx.update(chargeRates).set({ effectiveTo: addDaysIso(i.effectiveFrom, -1) }).where(eq(chargeRates.id, p.id));
    const [row] = await tx
      .insert(chargeRates)
      .values({ chargeHeadId: i.chargeHeadId, commodityId: i.commodityId ?? null, accountId: i.accountId ?? null, rate: Number(i.rate).toFixed(4), effectiveFrom: i.effectiveFrom, createdBy: actor.id })
      .returning();
    await audit(tx, actor, { table: "charge_rates", rowId: row.id, action: "rate_change", oldData: prev, newData: row });
    return { id: row.id };
  });
}

/** End a rate (e.g. remove a party override) from a date. */
export async function endChargeRate(input: { id: number; effectiveTo: string }) {
  return runAction("rate_master", async (tx, actor) => {
    const i = parse(z.object({ id: zId, effectiveTo: zDate }), input);
    const [old] = await tx.select().from(chargeRates).where(eq(chargeRates.id, i.id));
    if (!old) fail("दर नहीं मिली", "Rate not found");
    if (i.effectiveTo < old.effectiveFrom) fail("तारीख़ शुरुआत से पहले है", "End date is before the start");
    await tx.update(chargeRates).set({ effectiveTo: i.effectiveTo }).where(eq(chargeRates.id, i.id));
    await audit(tx, actor, { table: "charge_rates", rowId: i.id, action: "rate_change", oldData: old, newData: { effectiveTo: i.effectiveTo } });
    return true;
  });
}

/** Delete = inactive from a date; hard delete only if never used (PRD §6). */
export async function setHeadActive(input: { id: number; active: boolean; date: string; hardDelete?: boolean }) {
  return runAction("rate_master", async (tx, actor) => {
    const i = parse(z.object({ id: zId, active: z.boolean(), date: zDate, hardDelete: z.boolean().optional() }), input);
    const [old] = await tx.select().from(chargeHeads).where(eq(chargeHeads.id, i.id));
    if (!old) fail("खर्चा नहीं मिला", "Charge line not found");
    if (i.hardDelete) {
      const [used] = await tx.select({ n: sql<number>`count(*)::int` }).from(documentCharges).where(eq(documentCharges.chargeHeadId, i.id));
      const [ref] = await tx.select({ n: sql<number>`count(*)::int` }).from(chargeHeads).where(eq(chargeHeads.refHeadId, i.id));
      if (used.n > 0 || ref.n > 0) fail("यह खर्चा इस्तेमाल हो चुका है — केवल बंद कर सकते हैं", "This line has been used — it can only be made inactive");
      await tx.delete(chargeRates).where(eq(chargeRates.chargeHeadId, i.id));
      await tx.delete(chargeHeads).where(eq(chargeHeads.id, i.id));
      await audit(tx, actor, { table: "charge_heads", rowId: i.id, action: "delete", oldData: old });
      return true;
    }
    const next = i.active ? { activeTo: null, activeFrom: old.activeFrom > i.date ? i.date : old.activeFrom } : { activeTo: i.date };
    await tx.update(chargeHeads).set(next).where(eq(chargeHeads.id, i.id));
    await audit(tx, actor, { table: "charge_heads", rowId: i.id, action: i.active ? "activate" : "deactivate", oldData: old, newData: next });
    return true;
  });
}

export async function canEditRates() {
  const a = await requireActor();
  return can(a.role, "rate_master");
}
