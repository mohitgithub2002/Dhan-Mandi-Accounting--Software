import { notFound, redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { shulkReturns } from "@/db/schema";
import { Card, LinkButton, Notice, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { formatINR } from "@/lib/calc";
import { formatDate, isIsoDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { getFirm, getFy } from "@/lib/server/core";
import { cellText, totalsOf } from "@/lib/server/reportfmt";
import { reportByKey } from "@/lib/server/reports";
import { ReportFilters } from "./ReportFilters";
import { ShulkReturnForm } from "./ShulkReturnForm";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ from?: string; to?: string; group?: string }> }) {
  const { key } = await params;
  const def = reportByKey(key);
  if (!def) notFound();
  if (!def.run) redirect(def.href ?? "/report");
  const actor = await requirePage(def.perm);
  const { tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const sp = await searchParams;
  const fy = await getFy(db, wd, { forPosting: false });
  const to = isIsoDate(sp.to) ? sp.to : wd;
  const from = def.asOf ? to : isIsoDate(sp.from) ? sp.from : `${wd.slice(0, 8)}01` < fy.startDate ? fy.startDate : `${wd.slice(0, 8)}01`;
  const group = def.groups?.find((g) => g.value === sp.group)?.value ?? def.groups?.[0]?.value;
  const result = await def.run({ from, to, group });
  const totals = totalsOf(result.columns, result.rows);
  const firm = await getFirm(db);
  const qs = new URLSearchParams({ from, to, ...(group ? { group } : {}) }).toString();
  const filings = key === "mandi-shulk" ? await db.select().from(shulkReturns).orderBy(desc(shulkReturns.periodTo)).limit(20) : [];
  const label = (c: { hi: string; en: string }) => (lang === "en" ? c.en : c.hi);
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden print:block">
        <div className="text-xl font-bold">{lang === "en" ? firm.nameEn || firm.nameHi : firm.nameHi || firm.nameEn}</div>
        <div>{lang === "en" ? firm.addressEn : firm.addressHi}</div>
      </div>
      <PageHeader
        title={label(def)}
        subtitle={def.asOf ? `${tx("तारीख़ तक", "As of")} ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <>
            <LinkButton href={`/api/export/${key}?${qs}`}>Excel</LinkButton>
            <LinkButton href={`/print/report/${key}?${qs}`} target="_blank">
              {tx("प्रिंट / PDF", "Print / PDF")}
            </LinkButton>
          </>
        }
      />
      <ReportFilters from={from} to={to} asOf={!!def.asOf} groups={def.groups ?? []} group={group} />
      {result.note ? <Notice kind="info">{label(result.note)}</Notice> : null}
      <Card>
        <Table>
          <thead>
            <tr>
              {result.columns.map((c) => (
                <th key={c.key} className={`${thCls} ${["money", "kg", "num", "rate"].includes(c.type) ? "text-right" : ""}`}>
                  {label(c)}
                  {c.type === "kg" ? ` (${tx("क्विं.", "qtl")})` : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td className={tdCls} colSpan={result.columns.length}>
                  {tx("कोई एंट्री नहीं", "No entries")}
                </td>
              </tr>
            ) : null}
            {result.rows.map((r, i) => (
              <tr key={i} className={String(r.status ?? "").startsWith("रद्द") ? "text-slate-400" : ""}>
                {result.columns.map((c) => (
                  <td key={c.key} className={`${tdCls} ${["money", "kg", "num", "rate"].includes(c.type) ? "num" : ""}`}>
                    {c.key === "name_hi" && lang === "en" && r.name_en ? String(r.name_en) : cellText(c, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {Object.keys(totals).length ? (
            <tfoot>
              <tr className="font-bold">
                {result.columns.map((c, i) => (
                  <td key={c.key} className={`${tdCls} ${c.total ? "num" : ""}`}>
                    {i === 0 ? `${tx("कुल", "Total")} (${result.rows.length})` : c.total ? (c.type === "kg" ? formatINR(totals[c.key] / 100) : c.type === "money" ? formatINR(totals[c.key]) : totals[c.key]) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </Table>
      </Card>
      {key === "mandi-shulk" ? (
        <Card title={tx("रिटर्न जमा (चालान)", "Returns filed (challan)")}>
          {filings.length ? (
            <ul className="mb-3 list-disc pl-5">
              {filings.map((f) => (
                <li key={f.id}>
                  {formatDate(f.periodFrom)} – {formatDate(f.periodTo)} · {tx("चालान", "Challan")} {f.challanNo} ({formatDate(f.challanDate)}) · ₹{formatINR(f.amount)} {f.remarks}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-slate-500">{tx("अभी कोई रिटर्न दर्ज नहीं", "No return recorded yet")}</p>
          )}
          {can(actor.role, "day_close") ? <ShulkReturnForm from={from} to={to} amount={String((totals.shulk ?? 0) + (totals.kks ?? 0))} /> : null}
        </Card>
      ) : null}
    </div>
  );
}
