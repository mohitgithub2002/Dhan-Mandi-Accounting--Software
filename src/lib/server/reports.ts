import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { addDaysIso } from "@/lib/dates";
import type { Permission } from "@/lib/permissions";

/**
 * Report definitions (PRD §7). One definition drives the screen, the A4 print
 * and the Excel export, so they always agree.
 */
export type ColType = "text" | "money" | "kg" | "num" | "date" | "rate";

export interface Column {
  key: string;
  hi: string;
  en: string;
  type: ColType;
  total?: boolean;
}

export interface ReportParams {
  from: string;
  to: string;
  group?: string;
}

export interface ReportResult {
  columns: Column[];
  rows: Record<string, string | number | null>[];
  note?: { hi: string; en: string };
}

export interface ReportDef {
  key: string;
  hi: string;
  en: string;
  descHi: string;
  descEn: string;
  perm: Permission;
  groups?: { value: string; hi: string; en: string }[];
  /** Single "as of" date instead of a range. */
  asOf?: boolean;
  /** Link to a dedicated screen instead of the generic table. */
  href?: string;
  run?: (p: ReportParams) => Promise<ReportResult>;
}

const c = (key: string, hi: string, en: string, type: ColType = "text", total = false): Column => ({ key, hi, en, type, total });

const rowsOf = async (q: ReturnType<typeof sql>) => [...(await db.execute<Record<string, string | number | null>>(q))];

export const REPORTS: ReportDef[] = [
  { key: "saar", hi: "आज का सार", en: "Today's summary", descHi: "आमद, बिक्री, पर्ची, बिल, नकद-बैंक", descEn: "Arrivals, sales, parchis, bills, cash and bank", perm: "reports_own", href: "/" },
  { key: "nakal", hi: "नकल (रोज़नामचा)", en: "Nakal (day book)", descHi: "हर वाउचर समय अनुसार", descEn: "Every voucher in time order", perm: "reports", href: "/nakal" },
  { key: "rokad", hi: "रोकड़ बही / बैंक बही", en: "Cash book / bank book", descHi: "शुरुआती व अंतिम बाकी सहित", descEn: "With opening and closing", perm: "reports", href: "/rokad" },
  { key: "khata", hi: "खाता", en: "Khata (ledger)", descHi: "किसी भी खाते का, ब्याज सहित", descEn: "Any party, with or without byaj", perm: "reports", href: "/khata" },
  {
    key: "lena-dena",
    hi: "लेना-देना (बकाया)",
    en: "Lena-dena (outstanding)",
    descHi: "व्यापारी बकाया उम्र अनुसार; किसान देय",
    descEn: "Vyapari receivable with ageing; kisan payable",
    perm: "reports",
    asOf: true,
    groups: [
      { value: "vyapari", hi: "व्यापारी (लेना)", en: "Vyapari receivable" },
      { value: "kisan", hi: "किसान (देना)", en: "Kisan payable" },
    ],
    run: async ({ to, group }) => {
      if (group === "kisan") {
        const rows = await rowsOf(sql`
          SELECT a.id, a.name_hi, a.name_en, a.village, a.mobile,
            -((CASE WHEN a.opening_side = 'naam' THEN a.opening_amount ELSE -a.opening_amount END) + COALESCE(SUM(le.debit - le.credit), 0)) AS payable
          FROM accounts a LEFT JOIN ledger_entries le ON le.account_id = a.id AND le.date <= ${to}
          WHERE a.party_type = 'kisan'
          GROUP BY a.id
          HAVING -((CASE WHEN a.opening_side = 'naam' THEN a.opening_amount ELSE -a.opening_amount END) + COALESCE(SUM(le.debit - le.credit), 0)) <> 0
          ORDER BY payable DESC`);
        return {
          columns: [c("id", "खाता", "Khata", "num"), c("name_hi", "किसान", "Kisan"), c("village", "गांव", "Village"), c("mobile", "मोबाइल", "Mobile"), c("payable", "देय (+) / लेना (−)", "Payable (+) / receivable (−)", "money", true)],
          rows,
        };
      }
      const rows = await rowsOf(sql`
        WITH bal AS (
          SELECT a.id, a.name_hi, a.name_en, a.credit_days,
            (CASE WHEN a.opening_side = 'naam' THEN a.opening_amount ELSE -a.opening_amount END) + COALESCE((SELECT SUM(le.debit - le.credit) FROM ledger_entries le WHERE le.account_id = a.id AND le.date <= ${to}), 0) AS balance
          FROM accounts a WHERE a.party_type IN ('vyapari', 'agency')
        ), open AS (
          SELECT b.vyapari_id, (${to}::date - b.date) AS age,
            b.total - COALESCE((SELECT SUM(x.amount) FROM bill_allocations x WHERE x.bill_id = b.id), 0) AS pending
          FROM bills b WHERE b.status = 'active' AND b.date <= ${to}
        )
        SELECT bal.id, bal.name_hi, bal.name_en, bal.credit_days, bal.balance,
          COALESCE(SUM(open.pending) FILTER (WHERE open.age <= 7), 0) AS d0_7,
          COALESCE(SUM(open.pending) FILTER (WHERE open.age BETWEEN 8 AND 15), 0) AS d8_15,
          COALESCE(SUM(open.pending) FILTER (WHERE open.age BETWEEN 16 AND 30), 0) AS d16_30,
          COALESCE(SUM(open.pending) FILTER (WHERE open.age > 30), 0) AS d30
        FROM bal LEFT JOIN open ON open.vyapari_id = bal.id AND open.pending > 0
        GROUP BY bal.id, bal.name_hi, bal.name_en, bal.credit_days, bal.balance
        HAVING bal.balance <> 0
        ORDER BY bal.balance DESC`);
      return {
        columns: [
          c("id", "खाता", "Khata", "num"),
          c("name_hi", "व्यापारी", "Vyapari"),
          c("credit_days", "उधार दिन", "Credit days", "num"),
          c("d0_7", "0–7 दिन", "0–7 days", "money", true),
          c("d8_15", "8–15 दिन", "8–15 days", "money", true),
          c("d16_30", "16–30 दिन", "16–30 days", "money", true),
          c("d30", "30+ दिन", "30+ days", "money", true),
          c("balance", "कुल बाकी (नाम)", "Balance (naam)", "money", true),
        ],
        rows,
        note: { hi: "उम्र बिल की तारीख़ से; बकाया बिल-मिलान से।", en: "Age from bill date; pending from bill allocations." },
      };
    },
  },
  {
    key: "parchi-register",
    hi: "पर्ची रजिस्टर",
    en: "Parchi register",
    descHi: "सभी किसान पर्चियां, रद्द चिह्नित",
    descEn: "All kisan parchis, radd marked",
    perm: "reports",
    run: async ({ from, to }) => ({
      columns: [
        c("parchi_no", "नं.", "No.", "num"),
        c("date", "तारीख़", "Date", "date"),
        c("name_hi", "किसान", "Kisan"),
        c("village", "गांव", "Village"),
        c("gross", "रकम", "Amount", "money", true),
        c("deductions", "खर्चा", "Kharcha", "money", true),
        c("net", "नेट", "Net", "money", true),
        c("peshgi", "पेशगी", "Peshgi", "money", true),
        c("payable", "देय", "Payable", "money", true),
        c("status", "स्थिति", "Status"),
      ],
      rows: await rowsOf(sql`
        SELECT p.parchi_no, p.date::text AS date, a.name_hi, a.village,
          CASE WHEN p.status = 'active' THEN p.gross_amount ELSE 0 END AS gross,
          CASE WHEN p.status = 'active' THEN p.deductions ELSE 0 END AS deductions,
          CASE WHEN p.status = 'active' THEN p.net_amount ELSE 0 END AS net,
          CASE WHEN p.status = 'active' THEN p.peshgi_recovered ELSE 0 END AS peshgi,
          CASE WHEN p.status = 'active' THEN p.payable_amount ELSE 0 END AS payable,
          CASE WHEN p.status = 'radd' THEN 'रद्द / RADD: ' || COALESCE(p.radd_reason, '') ELSE '' END AS status
        FROM parchis p JOIN accounts a ON a.id = p.kisan_id
        WHERE p.date BETWEEN ${from} AND ${to} ORDER BY p.date, p.parchi_no`),
    }),
  },
  {
    key: "bill-register",
    hi: "बिल रजिस्टर",
    en: "Bill register",
    descHi: "सभी व्यापारी बिल, रद्द चिह्नित",
    descEn: "All vyapari bills, radd marked",
    perm: "reports",
    run: async ({ from, to }) => ({
      columns: [
        c("bill_no", "नं.", "No.", "num"),
        c("date", "तारीख़", "Date", "date"),
        c("name_hi", "व्यापारी", "Vyapari"),
        c("licence_no", "लाइसेंस", "Licence"),
        c("amount", "रकम", "Amount", "money", true),
        c("charges", "खर्चा", "Charges", "money", true),
        c("total", "कुल", "Total", "money", true),
        c("due_date", "देय तिथि", "Due", "date"),
        c("status", "स्थिति", "Status"),
      ],
      rows: await rowsOf(sql`
        SELECT b.bill_no, b.date::text AS date, a.name_hi, a.licence_no,
          CASE WHEN b.status = 'active' THEN b.amount ELSE 0 END AS amount,
          CASE WHEN b.status = 'active' THEN b.charges ELSE 0 END AS charges,
          CASE WHEN b.status = 'active' THEN b.total ELSE 0 END AS total,
          b.due_date::text AS due_date,
          CASE WHEN b.status = 'radd' THEN 'रद्द / RADD: ' || COALESCE(b.radd_reason, '') ELSE '' END AS status
        FROM bills b JOIN accounts a ON a.id = b.vyapari_id
        WHERE b.date BETWEEN ${from} AND ${to} ORDER BY b.date, b.bill_no`),
    }),
  },
  {
    key: "jins-bikri",
    hi: "जिंस अनुसार बिक्री",
    en: "Jins-wise sales",
    descHi: "क्विंटल, औसत भाव, रकम — दिन/महीना",
    descEn: "Quintals, average bhav, amount — per day / month",
    perm: "reports",
    groups: [
      { value: "day", hi: "दिन अनुसार", en: "By day" },
      { value: "month", hi: "महीना अनुसार", en: "By month" },
    ],
    run: async ({ from, to, group }) => {
      const period = group === "month" ? sql`to_char(l.date, 'YYYY-MM')` : sql`l.date::text`;
      return {
        columns: [
          c("period", group === "month" ? "महीना" : "तारीख़", group === "month" ? "Month" : "Date"),
          c("jins", "जिंस", "Jins"),
          c("lots", "ढेरी", "Lots", "num", true),
          c("bags", "बोरी", "Bags", "num", true),
          c("qtl", "क्विंटल", "Quintal", "kg", true),
          c("avg_bhav", "औसत भाव", "Avg bhav", "money"),
          c("amount", "रकम", "Amount", "money", true),
        ],
        rows: await rowsOf(sql`
          SELECT ${period} AS period, c.name_hi || ' / ' || c.name_en AS jins, COUNT(DISTINCT l.id) AS lots, SUM(ls.bags) AS bags,
            SUM(ls.net_kg) AS qtl, ROUND(SUM(ls.gross_amount) / NULLIF(SUM(ls.net_kg) / 100, 0), 2) AS avg_bhav, SUM(ls.amount) AS amount
          FROM lot_sales ls JOIN lots l ON l.id = ls.lot_id JOIN commodities c ON c.id = l.commodity_id
          WHERE l.date BETWEEN ${from} AND ${to} AND ls.net_kg > 0 AND ls.bhav IS NOT NULL
          GROUP BY 1, c.id, c.seq ORDER BY 1, c.seq`),
      };
    },
  },
  {
    key: "arhat-aamdani",
    hi: "आढ़त आमदनी",
    en: "Arhat aamdani (commission)",
    descHi: "व्यापारी, जिंस, महीना अनुसार",
    descEn: "By vyapari, jins, month",
    perm: "reports",
    groups: [
      { value: "vyapari", hi: "व्यापारी अनुसार", en: "By vyapari" },
      { value: "jins", hi: "जिंस अनुसार", en: "By jins" },
      { value: "month", hi: "महीना अनुसार", en: "By month" },
    ],
    run: async ({ from, to, group }) => {
      // Commission is split to jins proportionally to each bill line's amount.
      const key = group === "jins" ? sql`c.name_hi || ' / ' || c.name_en` : group === "month" ? sql`to_char(b.date, 'YYYY-MM')` : sql`a.name_hi`;
      return {
        columns: [c("k", group === "jins" ? "जिंस" : group === "month" ? "महीना" : "व्यापारी", group === "jins" ? "Jins" : group === "month" ? "Month" : "Vyapari"), c("sales", "बिक्री रकम", "Sales", "money", true), c("arhat", "आढ़त", "Arhat", "money", true)],
        rows: await rowsOf(sql`
          WITH arhat AS (
            SELECT dc.doc_id AS bill_id, SUM(dc.amount) AS amt FROM document_charges dc
            WHERE dc.doc_type = 'bill' AND dc.code IN ('ARHAT', 'ARHAT_SARKARI') GROUP BY dc.doc_id
          )
          SELECT ${key} AS k, SUM(bl.amount) AS sales,
            ROUND(SUM(COALESCE(ar.amt, 0) * bl.amount / NULLIF(b.amount, 0)), 2) AS arhat
          FROM bills b
          JOIN bill_lines bl ON bl.bill_id = b.id
          JOIN commodities c ON c.id = bl.commodity_id
          JOIN accounts a ON a.id = b.vyapari_id
          LEFT JOIN arhat ar ON ar.bill_id = b.id
          WHERE b.status = 'active' AND b.date BETWEEN ${from} AND ${to}
          GROUP BY 1 ORDER BY 1`),
      };
    },
  },
  {
    key: "mandi-shulk",
    hi: "मंडी शुल्क रजिस्टर",
    en: "Mandi shulk register",
    descHi: "जिंस/व्यापारी अनुसार शुल्क व कृषक कल्याण शुल्क",
    descEn: "Market fee and krishak kalyan shulk by jins / vyapari",
    perm: "reports",
    href: "/report/mandi-shulk",
    groups: [
      { value: "jins", hi: "जिंस अनुसार", en: "By jins" },
      { value: "vyapari", hi: "व्यापारी अनुसार", en: "By vyapari" },
    ],
    run: async ({ from, to, group }) => {
      const key = group === "vyapari" ? sql`a.name_hi || COALESCE(' (' || NULLIF(a.licence_no, '') || ')', '')` : sql`c.name_hi || ' / ' || c.name_en`;
      return {
        columns: [
          c("k", group === "vyapari" ? "व्यापारी (लाइसेंस)" : "जिंस", group === "vyapari" ? "Vyapari (licence)" : "Jins"),
          c("qtl", "क्विंटल", "Quintal", "kg", true),
          c("sales", "बिक्री रकम", "Sale value", "money", true),
          c("shulk", "मंडी शुल्क", "Mandi shulk", "money", true),
          c("kks", "कृषक कल्याण शुल्क", "Krishak kalyan", "money", true),
        ],
        rows: await rowsOf(sql`
          WITH ch AS (
            SELECT dc.doc_id AS bill_id,
              SUM(dc.amount) FILTER (WHERE dc.code = 'MANDI_SHULK') AS shulk,
              SUM(dc.amount) FILTER (WHERE dc.code = 'KKS') AS kks
            FROM document_charges dc WHERE dc.doc_type = 'bill' GROUP BY dc.doc_id
          )
          SELECT ${key} AS k, SUM(bl.net_kg) AS qtl, SUM(bl.amount) AS sales,
            ROUND(SUM(COALESCE(ch.shulk, 0) * bl.amount / NULLIF(b.amount, 0)), 2) AS shulk,
            ROUND(SUM(COALESCE(ch.kks, 0) * bl.amount / NULLIF(b.amount, 0)), 2) AS kks
          FROM bills b JOIN bill_lines bl ON bl.bill_id = b.id
          JOIN commodities c ON c.id = bl.commodity_id JOIN accounts a ON a.id = b.vyapari_id
          LEFT JOIN ch ON ch.bill_id = b.id
          WHERE b.status = 'active' AND b.date BETWEEN ${from} AND ${to}
          GROUP BY 1 ORDER BY 1`),
      };
    },
  },
  {
    key: "kharcha",
    hi: "खर्चा अनुसार रिपोर्ट",
    en: "Kharcha-wise report",
    descHi: "हर खर्चा लाइन: वसूला, चुकाया, बाकी",
    descEn: "Each kharcha line: collected, paid, balance",
    perm: "reports",
    run: async ({ from, to }) => ({
      columns: [c("head", "खर्चा", "Kharcha"), c("account", "खाता", "Account"), c("collected", "वसूला", "Collected", "money", true), c("paid", "चुकाया / नाम", "Paid / naam", "money", true), c("balance", "बाकी (जमा)", "Balance (jama)", "money", true)],
      rows: await rowsOf(sql`
        SELECT h.name_hi || ' / ' || h.name_en AS head, a.name_hi AS account,
          COALESCE((SELECT SUM(le.credit) FROM ledger_entries le WHERE le.account_id = a.id AND le.date BETWEEN ${from} AND ${to}), 0) AS collected,
          COALESCE((SELECT SUM(le.debit) FROM ledger_entries le WHERE le.account_id = a.id AND le.date BETWEEN ${from} AND ${to}), 0) AS paid,
          COALESCE((SELECT SUM(le.credit - le.debit) FROM ledger_entries le WHERE le.account_id = a.id AND le.date <= ${to}), 0) AS balance
        FROM charge_heads h JOIN accounts a ON a.id = h.post_account_id
        WHERE h.post_mode <> 'show' ORDER BY h.seq`),
      note: { hi: "एक खाते में कई खर्चे हों तो रकम हर लाइन पर पूरी दिखेगी।", en: "When several heads post to one account, its totals repeat on each line." },
    }),
  },
  {
    key: "tds",
    hi: "TDS रजिस्टर",
    en: "TDS register",
    descHi: "व्यापारी अनुसार 194H / 194Q",
    descEn: "Vyapari-wise 194H / 194Q",
    perm: "reports",
    run: async ({ from, to }) => ({
      columns: [c("quarter", "तिमाही", "Quarter"), c("name_hi", "व्यापारी", "Vyapari"), c("pan", "PAN", "PAN"), c("s194h", "194H", "194H", "money", true), c("s194q", "194Q", "194Q", "money", true)],
      rows: await rowsOf(sql`
        SELECT t.quarter, a.name_hi, a.pan,
          SUM(t.amount) FILTER (WHERE t.section = '194H') AS s194h, SUM(t.amount) FILTER (WHERE t.section = '194Q') AS s194q
        FROM tds_entries t JOIN vouchers v ON v.id = t.voucher_id AND v.status = 'active' JOIN accounts a ON a.id = t.vyapari_id
        WHERE v.date BETWEEN ${from} AND ${to} GROUP BY t.quarter, a.id ORDER BY t.quarter, a.name_hi`),
    }),
  },
  {
    key: "trial-balance",
    hi: "तलपट (ट्रायल बैलेंस)",
    en: "Trial balance",
    descHi: "हर खाते का बाकी — नाम और जमा",
    descEn: "Every account's balance — naam and jama",
    perm: "reports",
    asOf: true,
    run: async ({ to }) => ({
      columns: [c("grp", "समूह", "Group"), c("id", "खाता", "Khata", "num"), c("name", "नाम", "Name"), c("naam", "नाम", "Naam (Dr)", "money", true), c("jama", "जमा", "Jama (Cr)", "money", true)],
      rows: await rowsOf(sql`
        WITH b AS (
          SELECT a.id, g.name_hi || ' / ' || g.name_en AS grp, a.name_hi || CASE WHEN a.name_en <> '' THEN ' / ' || a.name_en ELSE '' END AS name,
            (CASE WHEN a.opening_side = 'naam' THEN a.opening_amount ELSE -a.opening_amount END)
              + COALESCE((SELECT SUM(le.debit - le.credit) FROM ledger_entries le WHERE le.account_id = a.id AND le.date <= ${to}), 0) AS bal
          FROM accounts a JOIN account_groups g ON g.id = a.group_id
        )
        SELECT grp, id, name, CASE WHEN bal > 0 THEN bal ELSE 0 END AS naam, CASE WHEN bal < 0 THEN -bal ELSE 0 END AS jama
        FROM b WHERE bal <> 0 ORDER BY grp, name`),
      note: { hi: "खुलती बाकी शामिल। नाम और जमा का जोड़ बराबर होना चाहिए।", en: "Includes opening balances. Naam and jama totals must match." },
    }),
  },
  {
    key: "audit",
    hi: "ऑडिट लॉग",
    en: "Audit log",
    descHi: "सुधार, रद्द, दर बदलाव, दिन खोलना",
    descEn: "Edits, radd, rate changes, day reopen",
    perm: "admin",
    run: async ({ from, to }) => ({
      columns: [c("at", "समय", "Time"), c("user_name", "यूज़र", "User"), c("action", "काम", "Action"), c("table_name", "तालिका", "Table"), c("row_id", "रिकॉर्ड", "Record"), c("reason", "कारण", "Reason"), c("change", "बदलाव", "Change")],
      rows: await rowsOf(sql`
        SELECT to_char(l.at AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH24:MI') AS at, u.name AS user_name, l.action, l.table_name, l.row_id, l.reason,
          LEFT(COALESCE(l.new_data::text, l.old_data::text, ''), 160) AS change
        FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
        WHERE l.at >= ${from}::date AND l.at < ${addDaysIso(to, 1)}::date AND l.action NOT IN ('login', 'print')
        ORDER BY l.at DESC LIMIT 2000`),
    }),
  },
];

export const reportByKey = (key: string) => REPORTS.find((r) => r.key === key);
