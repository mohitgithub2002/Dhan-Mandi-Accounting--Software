import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FirmHeader, SignatureLine } from "@/components/print/FirmHeader";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { TYPE_LABEL } from "@/components/VoucherList";
import { db } from "@/db";
import { accounts, tdsEntries, vouchers } from "@/db/schema";
import { amountInWords, formatINR } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { requirePage } from "@/lib/server/auth";
import { getFirm } from "@/lib/server/core";
import { nameIn, printLabels, resolvePrintLang } from "@/lib/server/printdata";

const MODE: Record<string, [string, string]> = {
  cash: ["नकद", "Cash"],
  cheque: ["चेक", "Cheque"],
  neft: ["NEFT/RTGS", "NEFT/RTGS"],
  upi: ["UPI", "UPI"],
  journal: ["जर्नल", "Journal"],
};

/** Raseed for a jama or naam voucher, printed on demand (PRD §5.7, §8). */
export default async function RaseedPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  await requirePage("print");
  const id = Number((await params).id);
  const sp = await searchParams;
  const [v] = await db.select().from(vouchers).where(eq(vouchers.id, id));
  if (!v) notFound();
  const lang = await resolvePrintLang(sp.lang);
  const { T } = await printLabels(lang);
  const firm = await getFirm(db);
  const party = v.partyId ? (await db.select().from(accounts).where(eq(accounts.id, v.partyId)))[0] : null;
  const bank = v.bankAccountId ? (await db.select().from(accounts).where(eq(accounts.id, v.bankAccountId)))[0] : null;
  const tds = await db.select().from(tdsEntries).where(eq(tdsEntries.voucherId, id));
  const isIn = v.type === "jama";
  const typeLabel = TYPE_LABEL[v.type] ?? [v.type, v.type];
  const wl = lang === "en" ? "en" : "hi";
  return (
    <>
      <PrintToolbar
        doc={{ docType: "voucher", id }}
        langLinks={[
          { label: "हिंदी", href: `?lang=hi`, active: lang === "hi" },
          { label: "English", href: `?lang=en`, active: lang === "en" },
          { label: "दोनों / Both", href: `?lang=both`, active: lang === "both" },
        ]}
      />
      <section className="sheet auto">
        {v.status === "radd" ? <div className="radd-stamp">रद्द / CANCELLED</div> : null}
        <FirmHeader
          firm={firm}
          lang={lang}
          title={`${T("रसीद", "Receipt")} — ${T(typeLabel[0], typeLabel[1])}`}
          mark={v.printCount > 0 ? "नकल / DUPLICATE" : "मूल / ORIGINAL"}
        />
        <table className="pt">
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>{T("नं.", "No.")}</th>
              <td>{v.voucherNo}</td>
              <th>{T("तारीख़", "Date")}</th>
              <td>{formatDate(v.date)}</td>
            </tr>
            <tr>
              <th>{isIn ? T("प्राप्त किया", "Received from") : T("भुगतान किया", "Paid to")}</th>
              <td colSpan={3}>
                {party ? `${nameIn(lang, party)}${party.village ? `, ${party.village}` : ""} (${T("खाता", "Khata")} ${party.id})` : "—"}
              </td>
            </tr>
            <tr>
              <th>{T("रकम", "Amount")}</th>
              <td colSpan={3} style={{ fontSize: "13pt", fontWeight: 700 }}>
                ₹ {formatINR(v.amount)}
              </td>
            </tr>
            <tr>
              <th>{T("शब्दों में", "In words")}</th>
              <td colSpan={3}>
                {amountInWords(v.amount, wl)} {wl === "hi" ? "मात्र" : "Only"}
              </td>
            </tr>
            <tr>
              <th>{T("तरीका", "Mode")}</th>
              <td>{T(MODE[v.mode]?.[0] ?? v.mode, MODE[v.mode]?.[1] ?? v.mode)}</td>
              <th>{T("संदर्भ", "Reference")}</th>
              <td>
                {v.refNo} {bank ? `· ${nameIn(lang, bank)}` : ""}
              </td>
            </tr>
            {tds.map((x) => (
              <tr key={x.id}>
                <th>TDS {x.section}</th>
                <td colSpan={3}>
                  ₹ {formatINR(x.amount)} ({x.quarter})
                </td>
              </tr>
            ))}
            <tr>
              <th>{T("विवरण", "Narration")}</th>
              <td colSpan={3}>{v.narration}</td>
            </tr>
          </tbody>
        </table>
        <SignatureLine left={isIn ? T("जमा करने वाले के हस्ताक्षर", "Payer's signature") : T("प्राप्तकर्ता के हस्ताक्षर", "Receiver's signature")} right={T(`कृते ${firm.nameHi || firm.nameEn}`, `For ${firm.nameEn || firm.nameHi}`)} />
      </section>
    </>
  );
}
