import Link from "next/link";
import { ActButton } from "@/components/ActionButtons";
import { DateRange } from "@/components/DateRange";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, Money, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { makeParchisAction } from "@/actions/entry";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { parchiList, todaySummary } from "@/lib/server/queries";
import { rangeFrom } from "@/lib/server/range";

export default async function ParchiListPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requirePage("reports_own");
  const { t, tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const { from, to, locked } = rangeFrom(await searchParams, actor, wd);
  const [rows, summary] = await Promise.all([parchiList(from, to), todaySummary(wd)]);
  const active = rows.filter((r) => r.status === "active");
  const sum = (k: "gross_amount" | "deductions" | "net_amount" | "payable_amount") => active.reduce((a, r) => a + Number(r[k]), 0);
  const pending = summary.counts.pending_parchi;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${t("kisanParchi")}`}
        subtitle={`${formatDate(from)} – ${formatDate(to)}`}
        actions={
          can(actor.role, "entry") && pending > 0 ? (
            <ActButton
              run={async () => { "use server"; return makeParchisAction({ date: wd }); }}
              label={`${tx("पर्चियां बनाएं", "Make parchis")} (${pending} ${tx("बाकी", "pending")})`}
              variant="success"
            />
          ) : null
        }
      />
      <DateRange from={from} to={to} disabled={locked} />
      <Card>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{tx("नं.", "No.")}</th>
              <th className={thCls}>{t("date")}</th>
              <th className={thCls}>{t("kisan")}</th>
              <th className={`${thCls} text-right`}>{t("rakam")}</th>
              <th className={`${thCls} text-right`}>{t("kharcha")}</th>
              <th className={`${thCls} text-right`}>{tx("नेट", "Net")}</th>
              <th className={`${thCls} text-right`}>{t("peshgi")}</th>
              <th className={`${thCls} text-right`}>{t("netPayable")}</th>
              <th className={thCls}>{t("status")}</th>
              <th className={thCls}>{t("print")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={tdCls} colSpan={10}>
                  {t("noData")}
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "radd" ? "text-slate-400 line-through" : ""}>
                <td className={tdCls}>
                  <Link className="font-semibold text-brand-700 underline" href={`/parchi/${r.id}`}>
                    {r.parchi_no}
                  </Link>
                </td>
                <td className={tdCls}>{formatDate(r.date)}</td>
                <td className={tdCls}>
                  {lang === "en" ? r.name_en || r.name_hi : r.name_hi || r.name_en}
                  <span className="text-sm text-slate-500"> {r.village}</span>
                  {r.sale_type === "sarkari" ? <span className="ml-1 text-sm text-blue-700">({tx("सरकारी", "Govt")})</span> : null}
                </td>
                <td className={`${tdCls} num`}><Money value={r.gross_amount} /></td>
                <td className={`${tdCls} num`}><Money value={r.deductions} /></td>
                <td className={`${tdCls} num`}><Money value={r.net_amount} /></td>
                <td className={`${tdCls} num`}><Money value={r.peshgi_recovered} /></td>
                <td className={`${tdCls} num font-semibold`}><Money value={r.payable_amount} /></td>
                <td className={tdCls}><StatusBadge status={r.status} /></td>
                <td className={tdCls}>
                  <a className="underline" href={`/print/parchi/${r.id}`} target="_blank">
                    {r.print_count ? `${t("print")} (${r.print_count})` : t("print")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className={tdCls} colSpan={3}>{t("total")} ({active.length})</td>
              <td className={`${tdCls} num`}><Money value={sum("gross_amount")} /></td>
              <td className={`${tdCls} num`}><Money value={sum("deductions")} /></td>
              <td className={`${tdCls} num`}><Money value={sum("net_amount")} /></td>
              <td className={tdCls} />
              <td className={`${tdCls} num`}><Money value={sum("payable_amount")} /></td>
              <td className={tdCls} colSpan={2} />
            </tr>
          </tfoot>
        </Table>
      </Card>
    </div>
  );
}
