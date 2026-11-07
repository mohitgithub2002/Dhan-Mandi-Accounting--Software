import { notFound } from "next/navigation";
import { FirmHeader, SignatureLine } from "@/components/print/FirmHeader";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { amountInWords, d, formatINR, formatQtlKg, sum } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { requirePage } from "@/lib/server/auth";
import { loadBill, nameIn, printLabels, resolvePrintLang, type PrintLang } from "@/lib/server/printdata";

type Data = NonNullable<Awaited<ReturnType<typeof loadBill>>>;

async function BillCopy({ data, lang, mark, showKisan }: { data: Data; lang: PrintLang; mark: string; showKisan: boolean }) {
  const { L, T } = await printLabels(lang);
  const { b, vyapari, lines, charges, firm, banks } = data;
  const printed = charges.filter((c) => c.printed);
  const wordsLang = lang === "en" ? "en" : "hi";
  const totalKg = sum(lines.map((l) => l.netKg));
  return (
    <section className="sheet">
      {b.status === "radd" ? <div className="radd-stamp">रद्द / CANCELLED</div> : null}
      <FirmHeader firm={firm} lang={lang} title={`${L("vyapariBill")} (I)`} mark={mark} />
      <table style={{ width: "100%", marginBottom: 6 }}>
        <tbody>
          <tr>
            <td>
              <b>{T("बिल नं.", "Bill no.")}:</b> {b.billNo}
            </td>
            <td style={{ textAlign: "right" }}>
              <b>{L("date")}:</b> {formatDate(b.date)}
              {b.dueDate ? ` · ${T("देय तिथि", "Due date")}: ${formatDate(b.dueDate)}` : ""}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <b>{L("vyapari")}:</b> {nameIn(lang, vyapari)}
              {vyapari.licenceNo ? ` · ${T("लाइसेंस", "Licence")}: ${vyapari.licenceNo}` : ""}
              {vyapari.gstin ? ` · GSTIN ${vyapari.gstin}` : ""}
              {vyapari.mobile ? ` · ${vyapari.mobile}` : ""} · {T("खाता नं.", "Khata no.")} {vyapari.id}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="pt">
        <thead>
          <tr>
            <th>#</th>
            {showKisan ? <th>{T("किसान", "Kisan")}</th> : null}
            <th>{T("जिंस", "Jins")}</th>
            <th className="r">{T("बोरी", "Bags")}</th>
            <th className="r">{T("शुद्ध वज़न", "Net wt")}</th>
            <th className="r">{T("भाव ₹/क्विं.", "Bhav ₹/qtl")}</th>
            <th className="r">{T("रकम", "Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td>
              {showKisan ? <td>{lang === "en" ? l.kisanEn || l.kisanHi : l.kisanHi || l.kisanEn}</td> : null}
              <td>{lang === "en" ? l.jinsEn : lang === "hi" ? l.jinsHi : `${l.jinsHi} / ${l.jinsEn}`}</td>
              <td className="r">{l.bags}</td>
              <td className="r">{formatQtlKg(l.netKg, wordsLang)}</td>
              <td className="r">{formatINR(l.bhav)}</td>
              <td className="r">{formatINR(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showKisan ? 3 : 2}>{L("total")}</td>
            <td className="r">{lines.reduce((a, l) => a + l.bags, 0)}</td>
            <td className="r">{formatQtlKg(totalKg, wordsLang)}</td>
            <td />
            <td className="r">{formatINR(b.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <table className="pt" style={{ marginTop: 6, width: "60%", marginLeft: "auto" }}>
        <tbody>
          {printed.map((c) => (
            <tr key={c.id}>
              <td>
                {lang === "en" ? c.nameEn : lang === "hi" ? c.nameHi : `${c.nameHi} / ${c.nameEn}`}
                {c.rateUsed ? ` @ ${d(c.rateUsed).toString()}${c.basis.startsWith("pct") ? "%" : ""}` : ""}
                {c.postMode === "show" ? " *" : ""}
              </td>
              <td className="r">{c.postMode === "show" ? `(${formatINR(c.amount)})` : `+ ${formatINR(c.amount)}`}</td>
            </tr>
          ))}
          {d(b.roundOff).isZero() ? null : (
            <tr>
              <td>{T("राउंड ऑफ", "Round off")}</td>
              <td className="r">{formatINR(b.roundOff)}</td>
            </tr>
          )}
          <tr>
            <td style={{ fontSize: "12pt" }}>
              <b>{T("कुल देय", "Total payable")}</b>
            </td>
            <td className="r" style={{ fontSize: "12pt" }}>
              <b>₹ {formatINR(b.total)}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 6 }}>
        <b>{T("शब्दों में", "In words")}:</b> {amountInWords(b.total, wordsLang)} {wordsLang === "hi" ? "मात्र" : "Only"}
        {lang === "both" ? <><br />{amountInWords(b.total, "en")} Only</> : null}
      </p>
      {printed.some((c) => c.postMode === "show") ? (
        <p style={{ fontSize: "9pt" }}>* {T("व्यापारी द्वारा मंडी समिति को सीधे देय — बिल कुल में शामिल नहीं", "Payable by the vyapari directly to the samiti — not in bill total")}</p>
      ) : null}
      {banks.length ? (
        <p style={{ fontSize: "9.5pt" }}>
          <b>{T("भुगतान हेतु बैंक", "Bank for payment")}:</b>{" "}
          {banks.map((bk) => `${bk.bankName || bk.nameEn} ${bk.bankAc ? `A/c ${bk.bankAc}` : ""} ${bk.ifsc ? `IFSC ${bk.ifsc}` : ""}`).join(" · ")}
        </p>
      ) : null}
      {b.status === "radd" ? <p><b>रद्द / Cancelled:</b> {b.raddReason}</p> : null}
      {firm.footerText ? <p style={{ fontSize: "9pt" }}>{firm.footerText}</p> : null}
      <SignatureLine left={T("व्यापारी के हस्ताक्षर", "Vyapari's signature")} right={T(`कृते ${firm.nameHi || firm.nameEn}`, `For ${firm.nameEn || firm.nameHi}`)} />
    </section>
  );
}

export default async function BillPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; auto?: string; kisan?: string }> }) {
  await requirePage("print");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadBill(Number(id));
  if (!data) notFound();
  const lang = await resolvePrintLang(sp.lang);
  const showKisan = sp.kisan !== "0";
  const reprint = data.b.printCount > 0;
  const base = `/print/bill/${id}?kisan=${showKisan ? 1 : 0}`;
  return (
    <>
      <PrintToolbar
        doc={{ docType: "bill", id: Number(id) }}
        auto={sp.auto === "1"}
        langLinks={[
          { label: "हिंदी", href: `${base}&lang=hi`, active: lang === "hi" },
          { label: "English", href: `${base}&lang=en`, active: lang === "en" },
          { label: "दोनों / Both", href: `${base}&lang=both`, active: lang === "both" },
          { label: showKisan ? "किसान नाम छुपाएं" : "किसान नाम दिखाएं", href: `/print/bill/${id}?lang=${lang}&kisan=${showKisan ? 0 : 1}`, active: false },
        ]}
      />
      <BillCopy data={data} lang={lang} mark={reprint ? "नकल / DUPLICATE" : "मूल — व्यापारी प्रति / ORIGINAL"} showKisan={showKisan} />
      <BillCopy data={data} lang={lang} mark="कार्यालय नकल / OFFICE COPY" showKisan={showKisan} />
    </>
  );
}
