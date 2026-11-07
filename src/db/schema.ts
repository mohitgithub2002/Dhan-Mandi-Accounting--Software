/**
 * Mandi Khata database schema (PRD §10).
 *
 * Money: numeric(14,2) · rates: numeric(10,4) · weights: numeric(12,2) kg.
 * Numerics come back from the driver as strings and are handled with decimal.js.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const rate = (name: string) => numeric(name, { precision: 10, scale: 4 });
const kg = (name: string) => numeric(name, { precision: 12, scale: 2 });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ firm */

export const firmSettings = pgTable("firm_settings", {
  id: integer("id").primaryKey().default(1),
  nameHi: text("name_hi").notNull().default(""),
  nameEn: text("name_en").notNull().default(""),
  licenceNo: text("licence_no").notNull().default(""),
  addressHi: text("address_hi").notNull().default(""),
  addressEn: text("address_en").notNull().default(""),
  phone: text("phone").notNull().default(""),
  pan: text("pan").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  logo: text("logo"), // data URL
  footerText: text("footer_text").notNull().default(""),
  defaultLang: text("default_lang").notNull().default("both"), // hi | en | both (print)
  parchiMode: text("parchi_mode").notNull().default("per_day"), // per_day | per_dheri
  billMode: text("bill_mode").notNull().default("per_day"),
  parchiLayout: text("parchi_layout").notNull().default("full"), // full | half
  totalRounding: text("total_rounding").notNull().default("nearest_1"),
  bhavWarnPct: rate("bhav_warn_pct").notNull().default("15"),
  cashLimit: money("cash_limit").notNull().default("10000"),
  byajDaysInMonth: integer("byaj_days_in_month").notNull().default(30),
  sarkariCreditKisan: boolean("sarkari_credit_kisan").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // malik | munim | operator | ca
  lang: text("lang").notNull().default("hi"),
  active: boolean("active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const financialYears = pgTable("financial_years", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().unique(), // 2026-27
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
});

/* -------------------------------------------------------------- accounts */

export const accountGroups = pgTable("account_groups", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameHi: text("name_hi").notNull(),
  nameEn: text("name_en").notNull(),
  nature: text("nature").notNull(), // asset | liability | income | expense
  parentId: integer("parent_id").references((): AnyPgColumn => accountGroups.id),
});

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    code: text("code").unique(), // system accounts only
    groupId: integer("group_id").notNull().references(() => accountGroups.id),
    partyType: text("party_type").notNull(), // kisan | vyapari | agency | labour | transporter | bank | cash | expense | income | payable | other
    nameHi: text("name_hi").notNull().default(""),
    nameEn: text("name_en").notNull().default(""),
    fatherName: text("father_name").notNull().default(""),
    village: text("village").notNull().default(""),
    tehsil: text("tehsil").notNull().default(""),
    mobile: text("mobile").notNull().default(""),
    pan: text("pan").notNull().default(""),
    aadhaarLast4: text("aadhaar_last4").notNull().default(""),
    bankName: text("bank_name").notNull().default(""),
    bankAc: text("bank_ac").notNull().default(""),
    ifsc: text("ifsc").notNull().default(""),
    gstin: text("gstin").notNull().default(""),
    licenceNo: text("licence_no").notNull().default(""),
    openingAmount: money("opening_amount").notNull().default("0"),
    openingSide: text("opening_side").notNull().default("jama"), // jama | naam
    creditDays: integer("credit_days").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("accounts_party_type_idx").on(t.partyType),
    index("accounts_name_hi_trgm").using("gin", sql`${t.nameHi} gin_trgm_ops`),
    index("accounts_name_en_trgm").using("gin", sql`${t.nameEn} gin_trgm_ops`),
    index("accounts_village_trgm").using("gin", sql`${t.village} gin_trgm_ops`),
    uniqueIndex("accounts_mobile_per_type").on(t.partyType, t.mobile).where(sql`${t.mobile} <> ''`),
  ],
);

export const interestRules = pgTable("interest_rules", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  ratePm: rate("rate_pm").notNull(),
  method: text("method").notNull().default("simple"), // simple | monthly | compound
  graceDays: integer("grace_days").notNull().default(0),
  overdueOnly: boolean("overdue_only").notNull().default(false), // vyapari: only balance beyond credit days
  effectiveFrom: date("effective_from").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/* ----------------------------------------------------------- commodities */

export const commodities = pgTable("commodities", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameHi: text("name_hi").notNull(),
  nameEn: text("name_en").notNull(),
  hsn: text("hsn").notNull().default(""),
  unit: text("unit").notNull().default("qtl"),
  feeGroup: text("fee_group").notNull().default("A"), // A 1.60% · B 1.00% · C 0.50%
  bagKg: kg("bag_kg").notNull().default("50"),
  defaultTareKg: kg("default_tare_kg").notNull().default("0"),
  defaultMoisturePct: rate("default_moisture_pct").notNull().default("0"),
  weighMode: text("weigh_mode").notNull().default("total"), // total | bagwise
  mspRate: money("msp_rate"),
  mspSeason: text("msp_season").notNull().default(""),
  seq: integer("seq").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/* ---------------------------------------------------- kharcha / tax master */

export const chargeHeads = pgTable("charge_heads", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameHi: text("name_hi").notNull(),
  nameEn: text("name_en").notNull(),
  kind: text("kind").notNull().default("kharcha"), // kharcha | shulk | katauti | gst
  basis: text("basis").notNull(), // pct_amount | per_qtl | per_bag | fixed_doc | pct_of_line
  refHeadId: integer("ref_head_id").references((): AnyPgColumn => chargeHeads.id),
  payer: text("payer").notNull(), // kisan | vyapari | split
  splitKisanPct: rate("split_kisan_pct").notNull().default("50"),
  saleType: text("sale_type").notNull().default("private"), // private | sarkari | both
  allowPartyOverride: boolean("allow_party_override").notNull().default(true),
  postMode: text("post_mode").notNull().default("income"), // income | payable | show
  postAccountId: integer("post_account_id").references(() => accounts.id),
  seq: integer("seq").notNull().default(0),
  rounding: text("rounding").notNull().default("none"), // none | nearest_1 | nearest_0_10 | up_1
  onParchi: boolean("on_parchi").notNull().default(true),
  onBill: boolean("on_bill").notNull().default(true),
  printLabelHi: text("print_label_hi").notNull().default(""),
  printLabelEn: text("print_label_en").notNull().default(""),
  activeFrom: date("active_from").notNull(),
  activeTo: date("active_to"),
  createdAt: createdAt(),
});

export const chargeRates = pgTable(
  "charge_rates",
  {
    id: serial("id").primaryKey(),
    chargeHeadId: integer("charge_head_id").notNull().references(() => chargeHeads.id),
    commodityId: integer("commodity_id").references(() => commodities.id),
    accountId: integer("account_id").references(() => accounts.id),
    rate: rate("rate").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("charge_rates_head_idx").on(t.chargeHeadId, t.effectiveFrom)],
);

/* -------------------------------------------------- aamad / dheri / sales */

export const arrivals = pgTable(
  "arrivals",
  {
    id: serial("id").primaryKey(),
    arrivalNo: integer("arrival_no").notNull(),
    fyId: integer("fy_id").notNull().references(() => financialYears.id),
    date: date("date").notNull(),
    kisanId: integer("kisan_id").notNull().references(() => accounts.id),
    gateEntryNo: text("gate_entry_no").notNull().default(""),
    vehicleNo: text("vehicle_no").notNull().default(""),
    remarks: text("remarks").notNull().default(""),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("arrivals_date_idx").on(t.date), uniqueIndex("arrivals_no_fy").on(t.fyId, t.arrivalNo)],
);

export const lots = pgTable(
  "lots",
  {
    id: serial("id").primaryKey(),
    arrivalId: integer("arrival_id").notNull().references(() => arrivals.id),
    kisanId: integer("kisan_id").notNull().references(() => accounts.id),
    commodityId: integer("commodity_id").notNull().references(() => commodities.id),
    date: date("date").notNull(),
    bags: integer("bags").notNull().default(0),
    qualityNote: text("quality_note").notNull().default(""),
    status: text("status").notNull().default("aamad"), // aamad | boli | tulai | parchi
    createdAt: createdAt(),
  },
  (t) => [index("lots_date_idx").on(t.date)],
);

export const lotSales = pgTable(
  "lot_sales",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id").notNull().references(() => lots.id),
    vyapariId: integer("vyapari_id").references(() => accounts.id),
    saleType: text("sale_type").notNull().default("private"), // private | sarkari
    bhav: money("bhav"),
    bags: integer("bags").notNull().default(0),
    weighMode: text("weigh_mode").notNull().default("total"),
    grossKg: kg("gross_kg").notNull().default("0"),
    tarePerBagKg: kg("tare_per_bag_kg").notNull().default("0"),
    tareKg: kg("tare_kg").notNull().default("0"),
    moisturePct: rate("moisture_pct").notNull().default("0"),
    moistureKg: kg("moisture_kg").notNull().default("0"),
    dustKg: kg("dust_kg").notNull().default("0"),
    netKg: kg("net_kg").notNull().default("0"),
    grossAmount: money("gross_amount").notNull().default("0"), // net qtl × bhav
    valueCut: money("value_cut").notNull().default("0"), // katauti heads that cut value
    amount: money("amount").notNull().default("0"), // rakam used by parchi and bill
    boliAt: timestamp("boli_at", { withTimezone: true }),
    tulaiAt: timestamp("tulai_at", { withTimezone: true }),
    parchiId: integer("parchi_id"),
    billId: integer("bill_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lot_sales_lot_idx").on(t.lotId), index("lot_sales_vyapari_idx").on(t.vyapariId)],
);

export const lotBagWeights = pgTable("lot_bag_weights", {
  id: serial("id").primaryKey(),
  lotSaleId: integer("lot_sale_id").notNull().references(() => lotSales.id, { onDelete: "cascade" }),
  bagNo: integer("bag_no").notNull(),
  kg: kg("kg").notNull(),
});

/* ------------------------------------------------------ vouchers / ledger */

export const vouchers = pgTable(
  "vouchers",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(), // parchi | bill | jama | naam | peshgi | kharcha | contra | journal | byaj | reversal
    voucherNo: integer("voucher_no").notNull(),
    fyId: integer("fy_id").notNull().references(() => financialYears.id),
    date: date("date").notNull(),
    narration: text("narration").notNull().default(""),
    mode: text("mode").notNull().default("journal"), // cash | cheque | neft | upi | journal
    refNo: text("ref_no").notNull().default(""),
    bankAccountId: integer("bank_account_id").references(() => accounts.id),
    partyId: integer("party_id").references(() => accounts.id),
    amount: money("amount").notNull().default("0"),
    status: text("status").notNull().default("active"), // active | radd
    reversesId: integer("reverses_id").references((): AnyPgColumn => vouchers.id),
    docType: text("doc_type"), // parchi | bill
    docId: integer("doc_id"),
    printCount: integer("print_count").notNull().default(0),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("vouchers_date_idx").on(t.date), uniqueIndex("vouchers_type_no_fy").on(t.type, t.fyId, t.voucherNo)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    voucherId: integer("voucher_id").notNull().references(() => vouchers.id),
    accountId: integer("account_id").notNull().references(() => accounts.id),
    date: date("date").notNull(),
    debit: money("debit").notNull().default("0"),
    credit: money("credit").notNull().default("0"),
    narration: text("narration").notNull().default(""),
  },
  (t) => [
    index("ledger_account_date_idx").on(t.accountId, t.date),
    index("ledger_voucher_idx").on(t.voucherId),
  ],
);

/* ------------------------------------------------------- parchi and bill */

export const parchis = pgTable(
  "parchis",
  {
    id: serial("id").primaryKey(),
    parchiNo: integer("parchi_no").notNull(),
    fyId: integer("fy_id").notNull().references(() => financialYears.id),
    date: date("date").notNull(),
    kisanId: integer("kisan_id").notNull().references(() => accounts.id),
    saleType: text("sale_type").notNull().default("private"),
    grossAmount: money("gross_amount").notNull(),
    deductions: money("deductions").notNull(),
    roundOff: money("round_off").notNull().default("0"),
    netAmount: money("net_amount").notNull(), // credited to kisan khata
    peshgiRecovered: money("peshgi_recovered").notNull().default("0"),
    payableAmount: money("payable_amount").notNull(), // net − peshgi recovered
    status: text("status").notNull().default("active"), // active | radd
    printCount: integer("print_count").notNull().default(0),
    voucherId: integer("voucher_id").references(() => vouchers.id),
    raddReason: text("radd_reason"),
    raddBy: integer("radd_by").references(() => users.id),
    raddAt: timestamp("radd_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("parchis_no_fy").on(t.fyId, t.parchiNo), index("parchis_date_idx").on(t.date)],
);

export const parchiLines = pgTable("parchi_lines", {
  id: serial("id").primaryKey(),
  parchiId: integer("parchi_id").notNull().references(() => parchis.id),
  lotSaleId: integer("lot_sale_id").notNull().references(() => lotSales.id),
  commodityId: integer("commodity_id").notNull().references(() => commodities.id),
  vyapariId: integer("vyapari_id").references(() => accounts.id),
  bags: integer("bags").notNull(),
  netKg: kg("net_kg").notNull(),
  bhav: money("bhav").notNull(),
  amount: money("amount").notNull(),
});

export const bills = pgTable(
  "bills",
  {
    id: serial("id").primaryKey(),
    billNo: integer("bill_no").notNull(),
    fyId: integer("fy_id").notNull().references(() => financialYears.id),
    date: date("date").notNull(),
    vyapariId: integer("vyapari_id").notNull().references(() => accounts.id),
    saleType: text("sale_type").notNull().default("private"),
    amount: money("amount").notNull(),
    charges: money("charges").notNull(),
    roundOff: money("round_off").notNull().default("0"),
    total: money("total").notNull(),
    dueDate: date("due_date"),
    status: text("status").notNull().default("active"),
    printCount: integer("print_count").notNull().default(0),
    voucherId: integer("voucher_id").references(() => vouchers.id),
    raddReason: text("radd_reason"),
    raddBy: integer("radd_by").references(() => users.id),
    raddAt: timestamp("radd_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bills_no_fy").on(t.fyId, t.billNo), index("bills_date_idx").on(t.date)],
);

export const billLines = pgTable("bill_lines", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull().references(() => bills.id),
  lotSaleId: integer("lot_sale_id").notNull().references(() => lotSales.id),
  commodityId: integer("commodity_id").notNull().references(() => commodities.id),
  kisanId: integer("kisan_id").references(() => accounts.id),
  bags: integer("bags").notNull(),
  netKg: kg("net_kg").notNull(),
  bhav: money("bhav").notNull(),
  amount: money("amount").notNull(),
});

export const documentCharges = pgTable(
  "document_charges",
  {
    id: serial("id").primaryKey(),
    docType: text("doc_type").notNull(), // parchi | bill
    docId: integer("doc_id").notNull(),
    chargeHeadId: integer("charge_head_id").notNull().references(() => chargeHeads.id),
    code: text("code").notNull(),
    nameHi: text("name_hi").notNull(),
    nameEn: text("name_en").notNull(),
    basis: text("basis").notNull(),
    basisValue: numeric("basis_value", { precision: 16, scale: 4 }).notNull(),
    rateUsed: rate("rate_used"),
    fullAmount: money("full_amount").notNull(),
    amount: money("amount").notNull(), // this side's share
    payer: text("payer").notNull(),
    postMode: text("post_mode").notNull(),
    postAccountId: integer("post_account_id").references(() => accounts.id),
    printed: boolean("printed").notNull().default(true),
    seq: integer("seq").notNull().default(0),
  },
  (t) => [index("document_charges_doc_idx").on(t.docType, t.docId)],
);

/* ------------------------------------------------- receipts, tds, byaj */

export const billAllocations = pgTable("bill_allocations", {
  id: serial("id").primaryKey(),
  receiptVoucherId: integer("receipt_voucher_id").notNull().references(() => vouchers.id),
  billId: integer("bill_id").notNull().references(() => bills.id),
  amount: money("amount").notNull(),
});

export const tdsEntries = pgTable("tds_entries", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull().references(() => vouchers.id),
  vyapariId: integer("vyapari_id").notNull().references(() => accounts.id),
  section: text("section").notNull(), // 194H | 194Q
  amount: money("amount").notNull(),
  quarter: text("quarter").notNull(), // 2026-27 Q3
  fyId: integer("fy_id").notNull().references(() => financialYears.id),
});

export const interestRuns = pgTable("interest_runs", {
  id: serial("id").primaryKey(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const interestLines = pgTable("interest_lines", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => interestRuns.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  product: numeric("product", { precision: 20, scale: 2 }).notNull(),
  rate: rate("rate").notNull(),
  amount: money("amount").notNull(),
  voucherId: integer("voucher_id").references(() => vouchers.id),
});

/* ------------------------------------------------- day close, misc */

export const dayCloses = pgTable("day_closes", {
  date: date("date").primaryKey(),
  isClosed: boolean("is_closed").notNull().default(true),
  closedBy: integer("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  reopenedBy: integer("reopened_by").references(() => users.id),
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  reopenReason: text("reopen_reason"),
});

export const cashCounts = pgTable("cash_counts", {
  date: date("date").primaryKey(),
  amount: money("amount").notNull(),
  countedBy: integer("counted_by").references(() => users.id),
  countedAt: timestamp("counted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const numberSeries = pgTable(
  "number_series",
  {
    id: serial("id").primaryKey(),
    docType: text("doc_type").notNull(),
    fyId: integer("fy_id").notNull().references(() => financialYears.id),
    prefix: text("prefix").notNull().default(""),
    nextNo: integer("next_no").notNull().default(1),
  },
  (t) => [uniqueIndex("number_series_doc_fy").on(t.docType, t.fyId)],
);

export const customLabels = pgTable("custom_labels", {
  key: text("key").primaryKey(),
  textHi: text("text_hi").notNull().default(""),
  textEn: text("text_en").notNull().default(""),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    action: text("action").notNull(), // create | edit | radd | rate_change | reopen | close | login ...
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    reason: text("reason"),
    userId: integer("user_id").references(() => users.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

export const backupsLog = pgTable("backups_log", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  file: text("file").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  source: text("source").notNull().default("manual"), // manual | scheduled
  userId: integer("user_id").references(() => users.id),
});

/** Mandi shulk returns marked as filed with the samiti (PRD §5.14). */
export const shulkReturns = pgTable("shulk_returns", {
  id: serial("id").primaryKey(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  challanNo: text("challan_no").notNull(),
  challanDate: date("challan_date").notNull(),
  amount: money("amount").notNull().default("0"),
  remarks: text("remarks").notNull().default(""),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: createdAt(),
});
