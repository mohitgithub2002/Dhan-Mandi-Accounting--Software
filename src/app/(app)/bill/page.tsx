import Link from "next/link";
import { ActButton } from "@/components/ActionButtons";
import { DateRange } from "@/components/DateRange";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, Money, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { makeBillsAction } from "@/actions/entry";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { billList, todaySummary } from "@/lib/server/queries";
import { rangeFrom } from "@/lib/server/range";

export default async function BillListPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await requirePage("reports_own");
  const { t, tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const { from, to, locked } = rangeFrom(await searchParams, actor, wd);
  const [rows, summary] = await Promise.all([billList(from, to), todaySummary(wd)]);
  const active = rows.filter((r) => r.status === "active");
  const sum = (k: "amount" | "charges" | "total") => active.reduce((a, r) => a + Number(r[k]), 0);
  const pending = summary.counts.pending_bill;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("vyapariBill")}
        subtitle={`${formatDate(from)} – ${formatDate(to)}`}
        actions={
          can(actor.role, "entry") && pending > 0 ? (
            <ActButton run={async () => { "use server"; return makeBillsAction({ date: wd }); }} label={`${tx("बिल बनाएं", "Make bills")} (${pending} ${tx("बाकी", "pending")})`} variant="success" />
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
              <th className={thCls}>{t("vyapari")}</th>
              <th className={`${thCls} text-right`}>{t("rakam")}</th>
              <th className={`${thCls} text-right`}>{t("kharcha")}</th>
              <th className={`${thCls} text-right`}>{t("total")}</th>
              <th className={`${thCls} text-right`}>{tx("मिला", "Received")}</th>
              <th className={thCls}>{tx("देय तिथि", "Due")}</th>
              <th className={thCls}>{t("status")}</th>
              <th className={thCls}>{t("print")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={tdCls} colSpan={10}>{t("noData")}</td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "radd" ? "text-slate-400 line-through" : ""}>
                <td className={tdCls}>
                  <Link className="font-semibold text-brand-700 underline" href={`/bill/${r.id}`}>{r.bill_no}</Link>
                </td>
                <td className={tdCls}>{formatDate(r.date)}</td>
                <td className={tdCls}>
                  {lang === "en" ? r.name_en || r.name_hi : r.name_hi || r.name_en}
                  {r.sale_type === "sarkari" ? <span className="ml-1 text-sm text-blue-700">({tx("सरकारी", "Govt")})</span> : null}
                </td>
                <td className={`${tdCls} num`}><Money value={r.amount} /></td>
                <td className={`${tdCls} num`}><Money value={r.charges} /></td>
                <td className={`${tdCls} num font-semibold`}><Money value={r.total} /></td>
                <td className={`${tdCls} num`}><Money value={r.allocated} /></td>
                <td className={tdCls}>{formatDate(r.due_date)}</td>
                <td className={tdCls}><StatusBadge status={r.status} /></td>
                <td className={tdCls}>
                  <a className="underline" href={`/print/bill/${r.id}`} target="_blank">
                    {r.print_count ? `${t("print")} (${r.print_count})` : t("print")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className={tdCls} colSpan={3}>{t("total")} ({active.length})</td>
              <td className={`${tdCls} num`}><Money value={sum("amount")} /></td>
              <td className={`${tdCls} num`}><Money value={sum("charges")} /></td>
              <td className={`${tdCls} num`}><Money value={sum("total")} /></td>
              <td className={tdCls} colSpan={4} />
            </tr>
          </tfoot>
        </Table>
      </Card>
    </div>
  );
}
