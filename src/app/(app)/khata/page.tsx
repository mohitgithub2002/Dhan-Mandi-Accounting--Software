import { db } from "@/db";
import { LedgerTable } from "@/components/LedgerTable";
import { Balance, Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { d } from "@/lib/calc";
import { formatDate, isIsoDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { accruedByaj } from "@/lib/server/byaj";
import { getAccount, getFy } from "@/lib/server/core";
import { ledgerFor } from "@/lib/server/queries";
import { KhataPicker } from "./KhataPicker";

export default async function KhataPage({ searchParams }: { searchParams: Promise<{ account?: string; from?: string; to?: string; byaj?: string }> }) {
  const actor = await requirePage("reports");
  const { t, tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const sp = await searchParams;
  const fy = await getFy(db, wd, { forPosting: false });
  const from = isIsoDate(sp.from) ? sp.from : fy.startDate;
  const to = isIsoDate(sp.to) ? sp.to : wd;
  const accountId = Number(sp.account) || null;
  const acc = accountId ? await getAccount(db, accountId).catch(() => null) : null;
  const data = acc ? await ledgerFor(acc.id, from, to) : null;
  const byaj = acc && sp.byaj === "1" ? await accruedByaj(db, acc.id, to) : null;
  const labels = { date: t("date"), type: tx("वाउचर", "Entry"), narration: t("narration"), naam: t("naam"), jama: t("jama"), balance: t("balance"), opening: t("opening"), closing: t("closing"), total: t("total") };
  const qs = `account=${accountId}&from=${from}&to=${to}${sp.byaj === "1" ? "&byaj=1" : ""}`;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("khata")}
        subtitle={acc ? `${lang === "en" ? acc.nameEn || acc.nameHi : acc.nameHi || acc.nameEn} · #${acc.id} · ${formatDate(from)} – ${formatDate(to)}` : tx("कोई भी खाता खोजें", "Find any account")}
        actions={acc ? <LinkButton href={`/print/khata?${qs}`} target="_blank">{t("print")}</LinkButton> : null}
      />
      <KhataPicker
        party={acc ? { id: acc.id, nameHi: acc.nameHi, nameEn: acc.nameEn, fatherName: acc.fatherName, village: acc.village, mobile: acc.mobile, partyType: acc.partyType } : null}
        from={from}
        to={to}
        byaj={sp.byaj === "1"}
      />
      {acc && data ? (
        <>
          {byaj ? (
            <Notice kind="info">
              {tx("ब्याज", "Byaj")} {formatDate(byaj.from)} – {formatDate(byaj.to)} @ {Number(byaj.ratePm)}% {tx("प्रति माह", "pm")}: <b>₹{byaj.amount}</b> ·{" "}
              {tx("ब्याज सहित बाकी", "Balance with byaj")}: <Balance value={d(data.closing).plus(byaj.amount).toFixed(2)} lang={lang} />
            </Notice>
          ) : sp.byaj === "1" ? (
            <Notice kind="info">{tx("इस खाते पर ब्याज नियम नहीं है", "No byaj rule on this account")}</Notice>
          ) : null}
          <Card>
            <LedgerTable data={data} lang={lang} labels={labels} />
          </Card>
        </>
      ) : null}
    </div>
  );
}
