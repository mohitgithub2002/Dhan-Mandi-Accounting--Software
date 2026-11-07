/**
 * Seed data: firm, groups, system accounts, jins master and the Hanumangarh Town
 * kharcha presets (PRD §6). Idempotent — safe to run again.
 * Every preset rate must be confirmed by the malik before go-live (PRD §13).
 */
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "./index";
import {
  accountGroups,
  accounts,
  chargeHeads,
  chargeRates,
  commodities,
  firmSettings,
  interestRules,
  users,
} from "./schema";

export const PRESET_FROM = "2026-04-01";

const GROUPS = [
  ["KISAN", "किसान खाते", "Kisan accounts", "liability"],
  ["VYAPARI", "व्यापारी खाते", "Vyapari accounts", "asset"],
  ["AGENCY", "सरकारी एजेंसी", "Govt agencies", "asset"],
  ["LABOUR", "पल्लेदार / मज़दूर", "Labour", "liability"],
  ["TRANSPORTER", "ट्रांसपोर्टर", "Transporters", "liability"],
  ["BANK", "बैंक", "Bank accounts", "asset"],
  ["CASH", "रोकड़", "Cash in hand", "asset"],
  ["INCOME", "आमदनी", "Income", "income"],
  ["EXPENSE", "खर्चे", "Expenses", "expense"],
  ["DUTIES", "शुल्क देय", "Duties and taxes payable", "liability"],
  ["SUSPENSE", "उचंत", "Suspense", "liability"],
  ["CURRENT_ASSETS", "चालू संपत्ति", "Current assets", "asset"],
  ["CAPITAL", "पूंजी", "Capital", "liability"],
] as const;

// code, group, party_type, hi, en
const SYSTEM_ACCOUNTS = [
  ["CASH", "CASH", "cash", "रोकड़", "Cash"],
  ["SALE_CLEARING", "SUSPENSE", "other", "बिक्री उचंत", "Sale clearing (kisan–vyapari)"],
  ["ARHAT_INCOME", "INCOME", "income", "आढ़त आमदनी", "Arhat income"],
  ["DHANKA_INCOME", "INCOME", "income", "धनका खाता", "Dhanka"],
  ["BARDANA_INCOME", "INCOME", "income", "बारदाना खाता", "Bardana"],
  ["BYAJ_INCOME", "INCOME", "income", "ब्याज आमदनी", "Interest income"],
  ["MANDI_SAMITI", "DUTIES", "payable", "मंडी समिति देय", "Mandi samiti payable"],
  ["KKS_PAYABLE", "DUTIES", "payable", "कृषक कल्याण शुल्क देय", "Krishak kalyan shulk payable"],
  ["TULAI_KHATA", "LABOUR", "labour", "तुलाई खाता", "Tulai (weighing) account"],
  ["PALLEDAR", "LABOUR", "labour", "पल्लेदार खाता", "Palledar account"],
  ["JHARAI_KHATA", "LABOUR", "labour", "झराई खाता", "Jharai (cleaning) account"],
  ["TDS_RECV", "CURRENT_ASSETS", "other", "टीडीएस प्राप्य", "TDS receivable"],
  ["ROUND_OFF", "EXPENSE", "expense", "राउंड ऑफ", "Round off"],
  ["BIJLI", "EXPENSE", "expense", "बिजली", "Electricity"],
  ["KIRAYA", "EXPENSE", "expense", "किराया", "Rent"],
  ["SALARY", "EXPENSE", "expense", "वेतन", "Salary"],
  ["MISC_EXP", "EXPENSE", "expense", "फुटकर खर्चा", "Miscellaneous expense"],
  ["CAPITAL", "CAPITAL", "other", "मालिक पूंजी", "Owner's capital"],
] as const;

// code, hi, en, hsn, fee group, weigh mode
const JINS = [
  ["GEHUN", "गेहूं", "Wheat", "1001", "A"],
  ["DHAN", "धान", "Paddy", "1006", "A"],
  ["SARSON", "सरसों", "Mustard", "1207", "A"],
  ["GUAR", "ग्वार", "Guar", "0713", "A"],
  ["CHANA", "चना", "Gram", "0713", "A"],
  ["JAU", "जौ", "Barley", "1003", "A"],
  ["KAPAS", "कपास", "Cotton", "5201", "B"],
  ["MOONG", "मूंग", "Moong", "0713", "A"],
  ["BAJRA", "बाजरा", "Bajra", "1008", "A"],
  ["MOTH", "मोठ", "Moth", "0713", "A"],
  ["TIL", "तिल", "Til (sesame)", "1207", "A"],
] as const;

/** Mandi shulk groups (PRD §5.1): A 1.60% · B 1.00% · C 0.50% — confirm per jins. */
export const FEE_GROUP_RATE: Record<string, string> = { A: "1.6", B: "1.0", C: "0.5" };

interface HeadSeed {
  code: string;
  hi: string;
  en: string;
  kind: string;
  basis: string;
  payer: string;
  postMode: string;
  account: string;
  seq: number;
  rounding?: string;
  saleType?: string;
  rate?: string; // generic rate; omitted = blank (not applied until entered)
  perJins?: "fee_group" | Record<string, string>;
  inactive?: boolean;
}

const HEADS: HeadSeed[] = [
  { code: "ARHAT", hi: "आढ़त / दामी", en: "Arhat (commission)", kind: "kharcha", basis: "pct_amount", payer: "vyapari", postMode: "income", account: "ARHAT_INCOME", seq: 10, rate: "2" },
  { code: "ARHAT_SARKARI", hi: "आढ़त (सरकारी खरीद)", en: "Arhat (govt procurement)", kind: "kharcha", basis: "per_qtl", payer: "vyapari", postMode: "income", account: "ARHAT_INCOME", seq: 15, saleType: "sarkari", perJins: { GEHUN: "45.67" } },
  { code: "TULAI", hi: "तुलाई", en: "Tulai (weighing)", kind: "kharcha", basis: "pct_amount", payer: "vyapari", postMode: "payable", account: "TULAI_KHATA", seq: 20, rounding: "nearest_1", rate: "0.25" },
  { code: "MANDI_SHULK", hi: "मंडी शुल्क", en: "Mandi shulk (market fee)", kind: "shulk", basis: "pct_amount", payer: "vyapari", postMode: "payable", account: "MANDI_SAMITI", seq: 30, perJins: "fee_group" },
  { code: "KKS", hi: "कृषक कल्याण शुल्क", en: "Krishak kalyan shulk", kind: "shulk", basis: "pct_amount", payer: "vyapari", postMode: "payable", account: "KKS_PAYABLE", seq: 40 },
  { code: "JHARAI", hi: "झराई", en: "Jharai (cleaning)", kind: "kharcha", basis: "per_qtl", payer: "kisan", postMode: "payable", account: "JHARAI_KHATA", seq: 50, rate: "0.5" },
  { code: "HAMMALI", hi: "हम्माली / पल्लेदारी", en: "Hammali / palledari", kind: "kharcha", basis: "per_bag", payer: "vyapari", postMode: "payable", account: "PALLEDAR", seq: 60 },
  { code: "BHARAI_SILAI", hi: "भराई, सिलाई", en: "Bharai, silai", kind: "kharcha", basis: "per_bag", payer: "vyapari", postMode: "payable", account: "PALLEDAR", seq: 70 },
  { code: "BARDANA", hi: "बारदाना", en: "Bardana (gunny bags)", kind: "kharcha", basis: "per_bag", payer: "vyapari", postMode: "income", account: "BARDANA_INCOME", seq: 80 },
  { code: "DHANKA", hi: "धनका", en: "Dhanka", kind: "kharcha", basis: "pct_amount", payer: "vyapari", postMode: "income", account: "DHANKA_INCOME", seq: 90, rate: "0.5", inactive: true },
];

export async function seed(db: DB, opts: { adminMobile?: string; adminPassword?: string; demo?: boolean } = {}) {
  await db
    .insert(firmSettings)
    .values({
      id: 1,
      nameHi: "मंडी खाता फर्म",
      nameEn: "Mandi Khata Firm",
      addressHi: "नई धान मंडी, हनुमानगढ़ टाउन, राजस्थान",
      addressEn: "Nai Dhan Mandi, Hanumangarh Town, Rajasthan",
      footerText: "धन्यवाद / Thank you",
    })
    .onConflictDoNothing();

  for (const [code, hi, en, nature] of GROUPS) {
    await db.insert(accountGroups).values({ code, nameHi: hi, nameEn: en, nature }).onConflictDoNothing();
  }
  const groups = Object.fromEntries((await db.select().from(accountGroups)).map((g) => [g.code, g.id]));

  for (const [code, group, partyType, hi, en] of SYSTEM_ACCOUNTS) {
    await db
      .insert(accounts)
      .values({ code, groupId: groups[group], partyType, nameHi: hi, nameEn: en, isSystem: true })
      .onConflictDoNothing();
  }
  const sys = Object.fromEntries(
    (await db.select({ id: accounts.id, code: accounts.code }).from(accounts)).filter((a) => a.code).map((a) => [a.code!, a.id]),
  );

  for (const [i, [code, hi, en, hsn, fee]] of JINS.entries()) {
    await db
      .insert(commodities)
      .values({ code, nameHi: hi, nameEn: en, hsn, feeGroup: fee, seq: (i + 1) * 10 })
      .onConflictDoNothing();
  }
  const jins = await db.select().from(commodities);
  const jinsByCode = Object.fromEntries(jins.map((c) => [c.code, c]));

  for (const h of HEADS) {
    const [existing] = await db.select().from(chargeHeads).where(eq(chargeHeads.code, h.code));
    if (existing) continue;
    const [row] = await db
      .insert(chargeHeads)
      .values({
        code: h.code,
        nameHi: h.hi,
        nameEn: h.en,
        kind: h.kind,
        basis: h.basis,
        payer: h.payer,
        postMode: h.postMode,
        postAccountId: sys[h.account],
        seq: h.seq,
        rounding: h.rounding ?? "none",
        saleType: h.saleType ?? "private",
        activeFrom: PRESET_FROM,
        activeTo: h.inactive ? PRESET_FROM : null,
      })
      .returning();
    if (h.rate) await db.insert(chargeRates).values({ chargeHeadId: row.id, rate: h.rate, effectiveFrom: PRESET_FROM });
    if (h.perJins === "fee_group") {
      for (const c of jins) {
        await db.insert(chargeRates).values({ chargeHeadId: row.id, commodityId: c.id, rate: FEE_GROUP_RATE[c.feeGroup] ?? "1.6", effectiveFrom: PRESET_FROM });
      }
    } else if (h.perJins) {
      for (const [code, rate] of Object.entries(h.perJins)) {
        await db.insert(chargeRates).values({ chargeHeadId: row.id, commodityId: jinsByCode[code].id, rate, effectiveFrom: PRESET_FROM });
      }
    }
  }

  const mobile = opts.adminMobile ?? "9999999999";
  const [admin] = await db.select().from(users).where(eq(users.mobile, mobile));
  if (!admin) {
    await db.insert(users).values({
      name: "मालिक",
      mobile,
      passwordHash: await bcrypt.hash(opts.adminPassword ?? "admin123", 10),
      role: "malik",
      lang: "hi",
    });
  }

  if (opts.demo) await seedDemo(db, groups);
}

/** Sample parties and users so the app can be tried out. Never run on live books. */
async function seedDemo(db: DB, groups: Record<string, number>) {
  const [any] = await db.select().from(accounts).where(and(eq(accounts.partyType, "kisan"), isNull(accounts.code))).limit(1);
  if (any) return;
  const kisans = [
    ["रमेश कुमार", "Ramesh Kumar", "हरी राम", "पीलीबंगा", "9800000001"],
    ["सुरेश सिंह", "Suresh Singh", "मोहन सिंह", "टिब्बी", "9800000002"],
    ["गुरप्रीत सिंह", "Gurpreet Singh", "बलवंत सिंह", "संगरिया", "9800000003"],
  ];
  for (const [hi, en, father, village, mobile] of kisans) {
    const [k] = await db
      .insert(accounts)
      .values({ groupId: groups.KISAN, partyType: "kisan", nameHi: hi, nameEn: en, fatherName: father, village, mobile })
      .returning();
    if (en === "Ramesh Kumar") await db.insert(interestRules).values({ accountId: k.id, ratePm: "1", method: "simple", effectiveFrom: PRESET_FROM });
  }
  const vyaparis = [
    ["अग्रवाल ट्रेडर्स", "Agarwal Traders", "HMH/L/101", 15],
    ["गोयल एंड संस", "Goyal & Sons", "HMH/L/102", 7],
    ["श्री बालाजी फूड्स", "Shri Balaji Foods", "HMH/L/103", 30],
  ] as const;
  for (const [hi, en, lic, days] of vyaparis) {
    await db.insert(accounts).values({ groupId: groups.VYAPARI, partyType: "vyapari", nameHi: hi, nameEn: en, licenceNo: lic, creditDays: days, village: "हनुमानगढ़" });
  }
  await db.insert(accounts).values({ groupId: groups.AGENCY, partyType: "agency", nameHi: "भारतीय खाद्य निगम (FCI)", nameEn: "Food Corporation of India" });
  await db.insert(accounts).values({ groupId: groups.BANK, partyType: "bank", nameHi: "एसबीआई चालू खाता", nameEn: "SBI Current A/c", bankName: "State Bank of India" });
  const hash = await bcrypt.hash("demo123", 10);
  await db
    .insert(users)
    .values([
      { name: "मुनीम जी", mobile: "9000000001", passwordHash: hash, role: "munim" },
      { name: "ऑपरेटर", mobile: "9000000002", passwordHash: hash, role: "operator" },
      { name: "CA Sahab", mobile: "9000000003", passwordHash: hash, role: "ca", lang: "en" },
    ])
    .onConflictDoNothing();
}
