import { notFound } from "next/navigation";
import { FirmHeader, SignatureLine } from "@/components/print/FirmHeader";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { amountInWords, d, formatINR, formatQtlKg, sum } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { requirePage } from "@/lib/server/auth";
import { loadParchi, nameIn, printLabels, resolvePrintLang, type PrintLang } from "@/lib/server/printdata";

type Data = NonNullable<Awaited<ReturnType<typeof loadParchi>>>;

async function ParchiCopy({ data, lang, mark, half, second }: { data: Data; lang: PrintLang; mark: string; half: boolean; second?: boolean }) {
  const { L, T } = await printLabels(lang);
  const { p, kisan, lines, charges, firm } = data;
  const printed = charges.filter((c) => c.printed);
  const totalBags = lines.reduce((a, l) => a + l.bags, 0);
  const totalKg = sum(lines.map((l) => l.netKg));
  const wordsLang = lang === "en" ? "en" : "hi";
  return (
    <section className={`sheet${half ? " half" : ""}${second ? " second" : ""}`}>
      {p.status === "radd" ? <div className="radd-stamp">रद्द / CANCELLED</div> : null}
      <FirmHeader firm={firm} lang={lang} title={`${L("kisanParchi")} (J)`} mark={mark} />
      <table style={{ width: "100%", marginBottom: 6 }}>
        <tbody>
          <tr>
            <td>
              <b>{T("पर्ची नं.", "Parchi no.")}:</b> {p.parchiNo}
            </td>
            <td style={{ textAlign: "right" }}>
              <b>{L("date")}:</b> {formatDate(p.date)}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <b>{L("kisan")}:</b> {nameIn(lang, kisan)} {kisan.fatherName ? `${T("पुत्र", "s/o")} ${kisan.fatherName}` : ""} · {L("gaon")}: {kisan.village || "—"}{" "}
              {kisan.mobile ? `· ${L("mobile")}: ${kisan.mobile}` : ""} · {T("खाता नं.", "Khata no.")} {kisan.id}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="pt">
        <thead>
          <tr>
            <th>#</th>
            <th>{T("जिंस", "Jins")}</th>
            <th>{T("व्यापारी", "Vyapari")}</th>
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
              <td>{lang === "en" ? l.jinsEn : lang === "hi" ? l.jinsHi : `${l.jinsHi} / ${l.jinsEn}`}</td>
              <td>{lang === "en" ? l.vyapariEn || l.vyapariHi : l.vyapariHi || l.vyapariEn}</td>
              <td className="r">{l.bags}</td>
              <td className="r">{formatQtlKg(l.netKg, wordsLang)}</td>
              <td className="r">{formatINR(l.bhav)}</td>
              <td className="r">{formatINR(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>{L("total")}</td>
            <td className="r">{totalBags}</td>
            <td className="r">{formatQtlKg(totalKg, wordsLang)}</td>
            <td />
            <td className="r">{formatINR(p.grossAmount)}</td>
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
              <td className="r">− {formatINR(c.amount)}</td>
            </tr>
          ))}
          {d(p.roundOff).isZero() ? null : (
            <tr>
              <td>{T("राउंड ऑफ", "Round off")}</td>
              <td className="r">{formatINR(p.roundOff)}</td>
            </tr>
          )}
          <tr>
            <td>
              <b>{T("शुद्ध रकम (खाते में जमा)", "Net (credited to khata)")}</b>
            </td>
            <td className="r">
              <b>{formatINR(p.netAmount)}</b>
            </td>
          </tr>
          {d(p.peshgiRecovered).gt(0) ? (
            <tr>
              <td>{T("पेशगी वसूली", "Peshgi recovered")}</td>
              <td className="r">− {formatINR(p.peshgiRecovered)}</td>
            </tr>
          ) : null}
          <tr>
            <td style={{ fontSize: "12pt" }}>
              <b>{L("netPayable")}</b>
            </td>
            <td className="r" style={{ fontSize: "12pt" }}>
              <b>₹ {formatINR(p.payableAmount)}</b>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 6 }}>
        <b>{T("शब्दों में", "In words")}:</b> {amountInWords(p.payableAmount, wordsLang)} {wordsLang === "hi" ? "मात्र" : "Only"}
        {lang === "both" ? <><br />{amountInWords(p.payableAmount, "en")} Only</> : null}
      </p>
      {p.saleType === "sarkari" ? <p style={{ fontSize: "9pt" }}>{T("सरकारी खरीद — फसल का भुगतान एजेंसी द्वारा सीधे किसान को।", "Govt procurement — crop value is paid by the agency directly to the kisan.")}</p> : null}
      {printed.some((c) => c.postMode === "show") ? <p style={{ fontSize: "9pt" }}>* {T("केवल सूचना हेतु", "For information only")}</p> : null}
      {p.status === "radd" ? <p><b>रद्द / Cancelled:</b> {p.raddReason}</p> : null}
      {firm.footerText ? <p style={{ fontSize: "9pt", marginTop: 4 }}>{firm.footerText}</p> : null}
      <SignatureLine left={T("किसान के हस्ताक्षर", "Kisan's signature")} right={T(`कृते ${firm.nameHi || firm.nameEn}`, `For ${firm.nameEn || firm.nameHi}`)} />
    </section>
  );
}

export default async function ParchiPrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; auto?: string; layout?: string }> }) {
  await requirePage("print");
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadParchi(Number(id));
  if (!data) notFound();
  const lang = await resolvePrintLang(sp.lang);
  const half = (sp.layout ?? data.firm.parchiLayout) === "half";
  const reprint = data.p.printCount > 0;
  const first = reprint ? "नकल / DUPLICATE" : "मूल — किसान प्रति / ORIGINAL";
  const office = "कार्यालय नकल / OFFICE COPY";
  const base = `/print/parchi/${id}?layout=${half ? "half" : "full"}`;
  return (
    <>
      <PrintToolbar
        doc={{ docType: "parchi", id: Number(id) }}
        auto={sp.auto === "1"}
        langLinks={[
          { label: "हिंदी", href: `${base}&lang=hi`, active: lang === "hi" },
          { label: "English", href: `${base}&lang=en`, active: lang === "en" },
          { label: "दोनों / Both", href: `${base}&lang=both`, active: lang === "both" },
          { label: half ? "पूरा A4" : "आधा A4 (2 प्रति)", href: `/print/parchi/${id}?lang=${lang}&layout=${half ? "full" : "half"}`, active: false },
        ]}
      />
      <ParchiCopy data={data} lang={lang} mark={first} half={half} />
      {half ? <hr className="cut-line" /> : null}
      <ParchiCopy data={data} lang={lang} mark={office} half={half} second />
    </>
  );
}
