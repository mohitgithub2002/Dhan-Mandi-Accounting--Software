import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashCounts } from "@/db/schema";
import { DateRange } from "@/components/DateRange";
import { LedgerTable } from "@/components/LedgerTable";
import { Balance, Card, PageHeader, cx } from "@/components/ui";
import { d } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { systemAccount } from "@/lib/server/core";
import { ledgerFor, listAccountsByType } from "@/lib/server/queries";
import { rangeFrom } from "@/lib/server/range";
import { CashCount } from "./CashCount";

/** Rokad bahi and bank bahi (PRD §5.8). */
export default async function RokadPage({ searchParams }: { searchParams: Promise<{ account?: string; from?: string; to?: string }> }) {
  const actor = await requirePage("reports");
  const { t, tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const sp = await searchParams;
  const { from, to } = rangeFrom(sp, actor, wd);
  const cashId = await systemAccount(db, "CASH");
  const banks = await listAccountsByType(["bank"]);
  const accountId = Number(sp.account) || cashId;
  const isCash = accountId === cashId;
  const data = await ledgerFor(accountId, from, to);
  const count = isCash && from === to ? (await db.select().from(cashCounts).where(eq(cashCounts.date, to)))[0] : undefined;
  const tabs = [{ id: cashId, label: t("rokad") }, ...banks.map((b) => ({ id: b.id, label: lang === "en" ? b.nameEn || b.nameHi : b.nameHi || b.nameEn }))];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={isCash ? tx("रोकड़ बही", "Cash book (Rokad)") : tx("बैंक बही", "Bank book")} subtitle={`${formatDate(from)} – ${formatDate(to)}`} />
      <div className="no-print flex flex-wrap gap-2">
        {tabs.map((x) => (
          <Link key={x.id} href={`/rokad?account=${x.id}&from=${from}&to=${to}`} className={cx("rounded-md border px-4 py-2", x.id === accountId ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white")}>
            {x.label}
          </Link>
        ))}
      </div>
      <DateRange from={from} to={to} />
      <Card>
        <LedgerTable
          data={data}
          lang={lang}
          labels={{ date: t("date"), type: tx("वाउचर", "Entry"), narration: t("narration"), naam: tx("आया (नाम)", "In (naam)"), jama: tx("गया (जमा)", "Out (jama)"), balance: t("balance"), opening: t("opening"), closing: t("closing"), total: t("total") }}
        />
      </Card>
      {isCash && from === to ? (
        <Card title={tx("नकद गिनती", "Physical cash count")}>
          <p className="mb-2">
            {tx("बही के अनुसार", "As per book")}: <Balance value={data.closing} lang={lang} />
            {count ? (
              <>
                {" · "}
                {tx("गिना गया", "Counted")}: ₹{count.amount} · {tx("अंतर", "Difference")}:{" "}
                <b className={d(count.amount).minus(d(data.closing)).isZero() ? "text-jama" : "text-naam"}>{d(count.amount).minus(d(data.closing)).toFixed(2)}</b>
              </>
            ) : null}
          </p>
          {can(actor.role, "day_close") ? <CashCount date={to} current={count?.amount ?? ""} /> : null}
        </Card>
      ) : null}
    </div>
  );
}
