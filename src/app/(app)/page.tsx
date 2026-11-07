import Link from "next/link";
import { Card, Money, Notice, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { formatQtlKg } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { lastBackup, todaySummary } from "@/lib/server/queries";

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await requirePage();
  const { t, tx, lang } = await getI18n();
  const date = await workingDate(actor);
  const sp = await searchParams;
  const s = await todaySummary(date);
  const backup = actor.role === "malik" ? await lastBackup() : null;
  const backupOld = actor.role === "malik" && (!backup || Date.now() - backup.at.getTime() > 24 * 3600 * 1000);
  const cash = s.money.find((m) => m.kind === "cash");
  const bank = s.money.find((m) => m.kind === "bank");

  const tiles: { label: string; value: React.ReactNode; href?: string; warn?: boolean }[] = [
    { label: tx("आमद", "Arrivals"), value: s.counts.arrivals, href: "/aamad" },
    { label: tx("ढेरी", "Lots"), value: s.counts.lots, href: "/aamad" },
    { label: tx("बोली बाकी", "Pending boli"), value: s.counts.pending_boli, href: "/boli", warn: s.counts.pending_boli > 0 },
    { label: tx("तुलाई बाकी", "Pending tulai"), value: s.counts.pending_tulai, href: "/tulai", warn: s.counts.pending_tulai > 0 },
    { label: tx("पर्ची बाकी", "Pending parchi"), value: s.counts.pending_parchi, href: "/parchi", warn: s.counts.pending_parchi > 0 },
    { label: tx("बिल बाकी", "Pending bills"), value: s.counts.pending_bill, href: "/bill", warn: s.counts.pending_bill > 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={tx("आज का सार", "Today's summary")} subtitle={formatDate(date)} />
      {sp.denied ? <Notice kind="error">{tx("आपको इस स्क्रीन की अनुमति नहीं है।", "You are not allowed to open that screen.")}</Notice> : null}
      {backupOld ? (
        <Notice kind="error">
          {tx("बैकअप 24 घंटे से पुराना है।", "Last backup is older than 24 hours.")}{" "}
          <Link className="underline" href="/settings/backup">
            {tx("अभी बैकअप लें", "Back up now")}
          </Link>
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href ?? "#"}
            className={`rounded-lg border p-4 shadow-sm ${tile.warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
          >
            <div className="text-sm text-slate-600">{tile.label}</div>
            <div className="text-3xl font-bold">{tile.value}</div>
          </Link>
        ))}
      </div>

      {can(actor.role, "entry") ? (
        <div className="flex flex-wrap gap-2">
          <Link href="/dheri" className="rounded-md bg-brand-700 px-5 py-3 text-lg font-semibold text-white">
            + {t("menu.dheri")} (Alt+N)
          </Link>
          <Link href="/boli" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-lg">
            {t("menu.boli")}
          </Link>
          <Link href="/tulai" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-lg">
            {t("menu.tulai")}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tx("जिंस अनुसार बिक्री", "Sales by commodity")}>
          <Table>
            <thead>
              <tr>
                <th className={thCls}>{t("jins")}</th>
                <th className={thCls}>{tx("ढेरी", "Lots")}</th>
                <th className={`${thCls} text-right`}>{t("netWeight")}</th>
                <th className={`${thCls} text-right`}>{t("rakam")}</th>
              </tr>
            </thead>
            <tbody>
              {s.byJins.length === 0 ? (
                <tr>
                  <td className={tdCls} colSpan={4}>
                    {t("noData")}
                  </td>
                </tr>
              ) : (
                s.byJins.map((r) => (
                  <tr key={r.name_hi}>
                    <td className={tdCls}>{lang === "en" ? r.name_en : r.name_hi}</td>
                    <td className={tdCls}>{r.sales}</td>
                    <td className={`${tdCls} num`}>{formatQtlKg(r.kg, lang)}</td>
                    <td className={`${tdCls} num`}>
                      <Money value={r.amount} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <Card title={tx("पर्ची, बिल और पैसा", "Parchis, bills and money")}>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt>{tx("पर्चियां", "Parchis")} ({s.docs.parchis})</dt>
            <dd className="num"><Money value={s.docs.parchi_total} /></dd>
            <dt>{tx("बिल", "Bills")} ({s.docs.bills})</dt>
            <dd className="num"><Money value={s.docs.bill_total} /></dd>
            <dt className="text-jama">{tx("नकद आया", "Cash in")}</dt>
            <dd className="num"><Money value={cash?.inflow} /></dd>
            <dt className="text-naam">{tx("नकद गया", "Cash out")}</dt>
            <dd className="num"><Money value={cash?.outflow} /></dd>
            <dt className="text-jama">{tx("बैंक में आया", "Bank in")}</dt>
            <dd className="num"><Money value={bank?.inflow} /></dd>
            <dt className="text-naam">{tx("बैंक से गया", "Bank out")}</dt>
            <dd className="num"><Money value={bank?.outflow} /></dd>
          </dl>
          {backup ? (
            <p className="mt-3 text-sm text-slate-500">
              {tx("आख़िरी बैकअप", "Last backup")}: {backup.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
