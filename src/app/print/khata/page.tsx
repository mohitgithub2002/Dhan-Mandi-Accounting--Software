import { notFound } from "next/navigation";
import { db } from "@/db";
import { LedgerTable } from "@/components/LedgerTable";
import { FirmHeader } from "@/components/print/FirmHeader";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { formatINR } from "@/lib/calc";
import { formatDate, isIsoDate, todayIST } from "@/lib/dates";
import { requirePage } from "@/lib/server/auth";
import { accruedByaj } from "@/lib/server/byaj";
import { getAccount, getFirm } from "@/lib/server/core";
import { nameIn, printLabels, resolvePrintLang } from "@/lib/server/printdata";
import { ledgerFor } from "@/lib/server/queries";

export default async function KhataPrint({ searchParams }: { searchParams: Promise<{ account?: string; from?: string; to?: string; byaj?: string; lang?: string }> }) {
  await requirePage("reports");
  const sp = await searchParams;
  const acc = await getAccount(db, Number(sp.account)).catch(() => null);
  if (!acc) notFound();
  const to = isIsoDate(sp.to) ? sp.to : todayIST();
  const from = isIsoDate(sp.from) ? sp.from : to;
  const lang = await resolvePrintLang(sp.lang);
  const { L, T } = await printLabels(lang);
  const data = await ledgerFor(acc.id, from, to);
  const byaj = sp.byaj === "1" ? await accruedByaj(db, acc.id, to) : null;
  const firm = await getFirm(db);
  const view = lang === "en" ? "en" : "hi";
  return (
    <>
      <PrintToolbar />
      <section className="sheet auto">
        <FirmHeader firm={firm} lang={lang} title={T("खाता विवरण", "Khata statement")} />
        <p>
          <b>{T("खाता", "Account")}:</b> {nameIn(lang, acc)} (#{acc.id}) {acc.village ? `· ${acc.village}` : ""} {acc.mobile ? `· ${acc.mobile}` : ""}
          <br />
          <b>{T("अवधि", "Period")}:</b> {formatDate(from)} – {formatDate(to)}
        </p>
        <LedgerTable
          data={data}
          lang={view}
          links={false}
          labels={{ date: L("date"), type: T("वाउचर", "Entry"), narration: L("narration"), naam: L("naam"), jama: L("jama"), balance: L("balance"), opening: L("opening"), closing: L("closing"), total: L("total") }}
        />
        {byaj ? (
          <p style={{ marginTop: 8 }}>
            <b>{T("ब्याज", "Byaj")}</b> {formatDate(byaj.from)} – {formatDate(byaj.to)} @ {Number(byaj.ratePm)}%: ₹{formatINR(byaj.amount)}
          </p>
        ) : null}
      </section>
    </>
  );
}
