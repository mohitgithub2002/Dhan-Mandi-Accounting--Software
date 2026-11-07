import { describe, expect, it } from "vitest";
import {
  amountInWords,
  billTotals,
  computeCharges,
  computeInterest,
  computeNetWeight,
  computeSale,
  formatINR,
  formatQtlKg,
  parchiTotals,
  rakam,
  roundBy,
  type HeadDef,
  type ResolvedRates,
} from "@/lib/calc";

const WHEAT = 1;
const MUSTARD = 2;

function head(p: Partial<HeadDef> & { id: number; code: string }): HeadDef {
  return {
    nameHi: p.code,
    nameEn: p.code,
    kind: "kharcha",
    basis: "pct_amount",
    refHeadId: null,
    payer: "vyapari",
    splitKisanPct: "50",
    postMode: "income",
    postAccountId: null,
    seq: p.id,
    rounding: "none",
    onParchi: true,
    onBill: true,
    ...p,
  };
}

// PRD §6 starting presets used in the worked example.
const heads: HeadDef[] = [
  head({ id: 1, code: "ARHAT", basis: "pct_amount", payer: "vyapari" }),
  head({ id: 2, code: "TULAI", basis: "pct_amount", payer: "vyapari", rounding: "nearest_1" }),
  head({ id: 3, code: "MANDI_SHULK", kind: "shulk", basis: "pct_amount", payer: "vyapari", postMode: "payable" }),
  head({ id: 4, code: "JHARAI", basis: "per_qtl", payer: "kisan", postMode: "payable" }),
  head({ id: 5, code: "KKS", kind: "shulk", basis: "pct_amount", payer: "vyapari", postMode: "payable" }),
];
const rates: ResolvedRates = {
  1: { generic: "2", byCommodity: {} },
  2: { generic: "0.25", byCommodity: {} },
  3: { generic: null, byCommodity: { [WHEAT]: "1.6", [MUSTARD]: "1.0" } },
  4: { generic: "0.5", byCommodity: {} },
  // 5 (krishak kalyan) left blank in presets → not applied
};

describe("PRD §6 worked example: 50 qtl wheat at ₹2,450/qtl", () => {
  const lines = [{ commodityId: WHEAT, netKg: "5000", bags: 100, amount: rakam("5000", "2450") }];
  const charges = computeCharges(heads, rates, lines);
  const byCode = Object.fromEntries(charges.map((c) => [c.code, c]));

  it("computes rakam", () => {
    expect(lines[0].amount.toFixed(2)).toBe("122500.00");
  });

  it("computes each kharcha line from the rate master", () => {
    expect(byCode.ARHAT.fullAmount).toBe("2450.00");
    expect(byCode.TULAI.fullAmount).toBe("306.00"); // 306.25 → 306
    expect(byCode.MANDI_SHULK.fullAmount).toBe("1960.00");
    expect(byCode.JHARAI.fullAmount).toBe("25.00");
    expect(byCode.KKS).toBeUndefined();
  });

  it("parchi net = 1,22,475", () => {
    const p = parchiTotals(lines, charges, "nearest_1");
    expect(p.net).toBe("122475.00");
    expect(p.deductions).toBe("25.00");
    expect(p.charges.map((c) => c.code)).toEqual(["JHARAI"]);
  });

  it("bill total = 1,27,216", () => {
    const b = billTotals(lines, charges, "nearest_1");
    expect(b.total).toBe("127216.00");
    expect(b.charges).toBe("4716.00");
    expect(b.roundOff).toBe("0.00");
  });
});

describe("charge engine options", () => {
  const lines = [
    { commodityId: WHEAT, netKg: "1050", bags: 21, amount: "25725.00" },
    { commodityId: MUSTARD, netKg: "2000", bags: 40, amount: "110000.00" },
  ];

  it("uses per-jins rates and leaves rateUsed empty when they differ", () => {
    const c = computeCharges(heads, rates, lines).find((x) => x.code === "MANDI_SHULK")!;
    // 25725 × 1.6% + 110000 × 1% = 411.60 + 1100
    expect(c.fullAmount).toBe("1511.60");
    expect(c.rateUsed).toBeNull();
  });

  it("per bag, fixed per document, % of another line, split payer", () => {
    const h = [
      head({ id: 10, code: "BHARAI", basis: "per_bag", payer: "vyapari", seq: 1 }),
      head({ id: 11, code: "PARCHI_FEE", basis: "fixed_doc", payer: "kisan", seq: 2 }),
      head({ id: 12, code: "ARHAT", basis: "pct_amount", payer: "vyapari", seq: 3 }),
      head({ id: 13, code: "GST_ARHAT", kind: "gst", basis: "pct_of_line", refHeadId: 12, payer: "vyapari", seq: 4 }),
      head({ id: 14, code: "DHANKA", basis: "pct_amount", payer: "split", splitKisanPct: "40", seq: 5 }),
    ];
    const r: ResolvedRates = {
      10: { generic: "3", byCommodity: {} },
      11: { generic: "10", byCommodity: {} },
      12: { generic: "2", byCommodity: {} },
      13: { generic: "18", byCommodity: {} },
      14: { generic: "0.5", byCommodity: {} },
    };
    const c = Object.fromEntries(computeCharges(h, r, lines).map((x) => [x.code, x]));
    expect(c.BHARAI.fullAmount).toBe("183.00"); // 61 bags × 3
    expect(c.PARCHI_FEE.fullAmount).toBe("10.00");
    expect(c.ARHAT.fullAmount).toBe("2714.50");
    expect(c.GST_ARHAT.fullAmount).toBe("488.61"); // 2714.50 × 18%
    expect(c.DHANKA.fullAmount).toBe("678.63"); // 135725 × 0.5% = 678.625
    expect(c.DHANKA.kisanAmount).toBe("271.45");
    expect(c.DHANKA.vyapariAmount).toBe("407.18");
    const p = parchiTotals(lines, Object.values(c), "none");
    expect(p.deductions).toBe("281.45"); // 10 + 271.45
  });

  it("show-only lines print but do not change totals", () => {
    const h = [head({ id: 1, code: "MANDI_SHULK", postMode: "show" })];
    const r: ResolvedRates = { 1: { generic: "1.6", byCommodity: {} } };
    const ls = [{ commodityId: WHEAT, netKg: "5000", bags: 100, amount: "122500" }];
    const b = billTotals(ls, computeCharges(h, r, ls), "nearest_1");
    expect(b.lines).toHaveLength(1);
    expect(b.total).toBe("122500.00");
  });

  it("party override rate is just a different resolved rate", () => {
    const ls = [{ commodityId: WHEAT, netKg: "5000", bags: 100, amount: "122500" }];
    const r = { ...rates, 1: { generic: "1.75", byCommodity: {} } };
    const c = computeCharges(heads, r, ls).find((x) => x.code === "ARHAT")!;
    expect(c.fullAmount).toBe("2143.75");
  });
});

describe("rounding rules", () => {
  it.each([
    ["none", "306.255", "306.26"],
    ["nearest_1", "306.25", "306"],
    ["nearest_1", "306.5", "307"],
    ["nearest_0_10", "306.25", "306.3"],
    ["up_1", "306.01", "307"],
  ])("%s %s → %s", (rule, v, expected) => {
    expect(roundBy(v, rule).toString()).toBe(expected);
  });
});

describe("tulai and katauti", () => {
  it("net = gross − tare − nami − dust", () => {
    const w = computeNetWeight({ grossKg: "5300", bags: 100, tarePerBagKg: "0.6", moisturePct: "1", dustKg: "5" });
    expect(w.tareKg.toFixed(2)).toBe("60.00");
    expect(w.moistureKg.toFixed(2)).toBe("52.40"); // (5300 − 60) × 1%
    expect(w.netKg.toFixed(2)).toBe("5182.60");
  });

  it("value katauti cuts rakam once per sale", () => {
    const h = [head({ id: 20, code: "QUALITY_CUT", kind: "katauti", basis: "per_qtl", rounding: "nearest_1" })];
    const s = computeSale(
      { commodityId: WHEAT, grossKg: "5000", bags: 100, bhav: "2450" },
      h,
      { 20: { generic: "5", byCommodity: {} } },
    );
    expect(s.grossAmount).toBe("122500.00");
    expect(s.valueCut).toBe("250.00");
    expect(s.amount).toBe("122250.00");
  });

  it("formats weight in quintal-kilo", () => {
    expect(formatQtlKg("5235")).toBe("52 qtl 35 kg");
    expect(formatQtlKg("5235", "hi")).toBe("52 क्विं. 35 कि.ग्रा.");
    expect(formatQtlKg("5235.5")).toBe("52 qtl 35.5 kg");
  });
});

describe("formatting", () => {
  it("Indian grouping", () => {
    expect(formatINR("122500")).toBe("1,22,500.00");
    expect(formatINR("12345678.5")).toBe("1,23,45,678.50");
    expect(formatINR("-999")).toBe("-999.00");
  });

  it("amount in words", () => {
    expect(amountInWords("122500", "hi")).toBe("एक लाख बाईस हज़ार पांच सौ रुपये");
    expect(amountInWords("122500", "en")).toBe("One Lakh Twenty Two Thousand Five Hundred Rupees");
    expect(amountInWords("127216.50", "en")).toBe(
      "One Lakh Twenty Seven Thousand Two Hundred Sixteen Rupees and Fifty Paise",
    );
    expect(amountInWords("23500000", "hi")).toBe("दो करोड़ पैंतीस लाख रुपये");
  });
});

describe("byaj by daily product", () => {
  it("₹10,000 peshgi at 1% per month for 30 days = ₹100", () => {
    const r = computeInterest({
      openingBalance: 0,
      movements: [{ date: "2026-01-01", debit: "10000", credit: 0 }],
      from: "2026-01-01",
      to: "2026-01-30",
      ratePm: "1",
    });
    expect(r.product).toBe("300000.00");
    expect(r.amount).toBe("100.00");
  });

  it("hand calculation with a part repayment", () => {
    // 20,000 naam for 10 days, then 5,000 jama → 15,000 for 20 days.
    // product = 2,00,000 + 3,00,000 = 5,00,000; × 1.5% ÷ 30 = 250
    const r = computeInterest({
      openingBalance: "20000",
      movements: [{ date: "2026-02-11", debit: 0, credit: "5000" }],
      from: "2026-02-01",
      to: "2026-03-02",
      ratePm: "1.5",
    });
    expect(r.days).toBe(30);
    expect(r.product).toBe("500000.00");
    expect(r.amount).toBe("250.00");
  });

  it("jama balance earns nothing; credit days exclude recent debits", () => {
    const jama = computeInterest({ openingBalance: "-5000", movements: [], from: "2026-01-01", to: "2026-01-31", ratePm: "1" });
    expect(jama.amount).toBe("0.00");
    const overdue = computeInterest({
      openingBalance: 0,
      movements: [{ date: "2026-01-01", debit: "30000", credit: 0 }],
      notDueDays: 15,
      from: "2026-01-01",
      to: "2026-01-30",
      ratePm: "1",
    });
    // due only from day 16 (Jan 16) to Jan 30 = 15 days × 30,000 = 4,50,000 → 150
    expect(overdue.product).toBe("450000.00");
    expect(overdue.amount).toBe("150.00");
  });

  it("monthly method rounds per month", () => {
    const r = computeInterest({
      openingBalance: "1000",
      movements: [],
      from: "2026-01-01",
      to: "2026-02-28",
      ratePm: "1",
      method: "monthly",
    });
    expect(r.months).toHaveLength(2);
    expect(r.amount).toBe("19.00"); // 31,000→10.33→10 ; 28,000→9.33→9
  });
});
