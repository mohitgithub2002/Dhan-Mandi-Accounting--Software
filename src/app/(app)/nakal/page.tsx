import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dayCloses } from "@/db/schema";
import { Card, Money, Notice, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { TYPE_LABEL } from "@/components/VoucherList";
import { formatDate, isIsoDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { vouchersFor } from "@/lib/server/queries";
import { DayCloseControls } from "./DayCloseControls";
import { DatePick } from "./DatePick";

/** Nakal (day book) and din band (PRD §5.13). */
export default async function NakalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const actor = await requirePage("reports");
  const { t, tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const sp = await searchParams;
  const date = isIsoDate(sp.date) ? sp.date : wd;
  const rows = await vouchersFor(date, date);
  const [close] = await db.select().from(dayCloses).where(eq(dayCloses.date, date));
  const money = await db.execute<{ kind: string; inflow: string; outflow: string }>(sql`
    SELECT CASE WHEN a.code = 'CASH' THEN 'cash' ELSE 'bank' END AS kind, COALESCE(SUM(le.debit),0) AS inflow, COALESCE(SUM(le.credit),0) AS outflow
    FROM ledger_entries le JOIN accounts a ON a.id = le.account_id
    WHERE le.date = ${date} AND (a.code = 'CASH' OR a.party_type = 'bank') GROUP BY 1`);
  const byType = new Map<string, { n: number; amount: number }>();
  for (const r of rows.filter((x) => x.status === "active" && x.type !== "reversal")) {
    const e = byType.get(r.type) ?? { n: 0, amount: 0 };
    byType.set(r.type, { n: e.n + 1, amount: e.amount + Number(r.amount) });
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nakal")} subtitle={formatDate(date)} />
      <div className="no-print flex flex-wrap items-end gap-4">
        <DatePick date={date} />
        {close?.isClosed ? <Notice kind="warn">🔒 {tx("दिन बंद है", "Day is closed")}</Notice> : null}
        {close && !close.isClosed && close.reopenReason ? <Notice kind="info">{tx("दिन फिर खोला गया", "Day reopened")}: {close.reopenReason}</Notice> : null}
        <DayCloseControls date={date} closed={!!close?.isClosed} canClose={can(actor.role, "day_close")} canReopen={can(actor.role, "day_reopen")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tx("प्रकार अनुसार जोड़", "Totals by type")}>
          <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
            {[...byType.entries()].map(([k, v]) => (
              <div key={k} className="contents">
                <dt>{TYPE_LABEL[k]?.[lang === "en" ? 1 : 0] ?? k}</dt>
                <dd>{v.n}</dd>
                <dd className="num"><Money value={v.amount} /></dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title={tx("नकद और बैंक", "Cash and bank")}>
          <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
            <dt />
            <dd className="text-sm text-jama">{tx("आया", "In")}</dd>
            <dd className="text-sm text-naam">{tx("गया", "Out")}</dd>
            {money.map((m) => (
              <div key={m.kind} className="contents">
                <dt>{m.kind === "cash" ? t("cash") : t("bank")}</dt>
                <dd className="num"><Money value={m.inflow} /></dd>
                <dd className="num"><Money value={m.outflow} /></dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <Card title={tx("दिन की सभी एंट्री (समय अनुसार)", "All entries of the day (in time order)")}>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{tx("समय", "Time")}</th>
              <th className={thCls}>{tx("प्रकार", "Type")}</th>
              <th className={thCls}>{tx("नं.", "No.")}</th>
              <th className={thCls}>{tx("खाता", "Party")}</th>
              <th className={thCls}>{t("narration")}</th>
              <th className={`${thCls} text-right`}>{t("rakam")}</th>
              <th className={thCls}>{t("status")}</th>
              <th className={thCls}>{tx("यूज़र", "User")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={tdCls} colSpan={8}>{t("noData")}</td>
              </tr>
            ) : null}
            {rows.map((v) => (
              <tr key={v.id} className={v.status === "radd" || v.type === "reversal" ? "text-slate-500" : ""}>
                <td className={tdCls}>{new Date(v.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</td>
                <td className={tdCls}>{TYPE_LABEL[v.type]?.[lang === "en" ? 1 : 0] ?? v.type}</td>
                <td className={tdCls}>
                  <a className="text-brand-700 underline" href={v.doc_type === "parchi" ? `/parchi/${v.doc_id}` : v.doc_type === "bill" ? `/bill/${v.doc_id}` : `/print/raseed/${v.id}`}>
                    {v.voucher_no}
                  </a>
                </td>
                <td className={tdCls}>{(lang === "en" ? v.party_en || v.party_hi : v.party_hi || v.party_en) ?? ""}</td>
                <td className={tdCls}>{v.narration}</td>
                <td className={`${tdCls} num`}><Money value={v.amount} /></td>
                <td className={tdCls}><StatusBadge status={v.status} /></td>
                <td className={tdCls}>{v.user_name}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
