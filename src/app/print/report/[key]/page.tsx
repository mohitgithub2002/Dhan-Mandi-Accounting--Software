import { notFound } from "next/navigation";
import { db } from "@/db";
import { FirmHeader } from "@/components/print/FirmHeader";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { formatINR } from "@/lib/calc";
import { formatDate, isIsoDate, todayIST } from "@/lib/dates";
import { requirePage } from "@/lib/server/auth";
import { getFirm } from "@/lib/server/core";
import { resolvePrintLang } from "@/lib/server/printdata";
import { cellText } from "@/lib/server/reportfmt";
import { reportByKey, type Column } from "@/lib/server/reports";

const ROWS_PER_PAGE = 26;
const isNum = (c: Column) => ["money", "kg", "num", "rate"].includes(c.type);
const fmtTotal = (c: Column, v: number) => (c.type === "kg" ? formatINR(v / 100) : c.type === "money" ? formatINR(v) : String(v));

/** Register print with running page totals: "pichhla jod" on top, "aage le jaya" at the bottom (PRD §8). */
export default async function ReportPrint({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ from?: string; to?: string; group?: string; lang?: string }> }) {
  const { key } = await params;
  const def = reportByKey(key);
  if (!def?.run) notFound();
  await requirePage(def.perm);
  const sp = await searchParams;
  const to = isIsoDate(sp.to) ? sp.to : todayIST();
  const from = def.asOf ? to : isIsoDate(sp.from) ? sp.from : to;
  const lang = await resolvePrintLang(sp.lang);
  const result = await def.run({ from, to, group: sp.group });
  const firm = await getFirm(db);
  const label = (c: { hi: string; en: string }) => (lang === "hi" ? c.hi : lang === "en" ? c.en : `${c.hi} / ${c.en}`);
  const totalCols = result.columns.filter((c) => c.total);
  const pages: (typeof result.rows)[] = [];
  for (let i = 0; i < Math.max(result.rows.length, 1); i += ROWS_PER_PAGE) pages.push(result.rows.slice(i, i + ROWS_PER_PAGE));
  const running: Record<string, number> = Object.fromEntries(totalCols.map((c) => [c.key, 0]));
  const T = (hi: string, en: string) => (lang === "hi" ? hi : lang === "en" ? en : `${hi} / ${en}`);

  return (
    <>
      <PrintToolbar />
      {pages.map((rows, pi) => {
        const before = { ...running };
        for (const r of rows) for (const c of totalCols) running[c.key] += Number(r[c.key]) || 0;
        const last = pi === pages.length - 1;
        const totalRow = (vals: Record<string, number>, text: string) => (
          <tr style={{ fontWeight: 700, background: "#f6f6f6" }}>
            {result.columns.map((c, i) => (
              <td key={c.key} className={isNum(c) ? "r" : ""}>
                {i === 0 ? text : c.total ? fmtTotal(c, vals[c.key]) : ""}
              </td>
            ))}
          </tr>
        );
        return (
          <section key={pi} className="sheet auto">
            <FirmHeader firm={firm} lang={lang} title={label(def)} />
            <p style={{ margin: "2px 0 6px" }}>
              {def.asOf ? `${T("तारीख़ तक", "As of")} ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`} · {T("पेज", "Page")} {pi + 1} / {pages.length}
            </p>
            <table className="pt">
              <thead>
                <tr>
                  {result.columns.map((c) => (
                    <th key={c.key} className={isNum(c) ? "r" : ""}>
                      {label(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pi > 0 && totalCols.length ? totalRow(before, T("पिछला जोड़", "Brought forward")) : null}
                {rows.map((r, i) => (
                  <tr key={i}>
                    {result.columns.map((c) => (
                      <td key={c.key} className={isNum(c) ? "r" : ""}>
                        {cellText(c, r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {totalCols.length ? totalRow(running, last ? T("कुल जोड़", "Grand total") : T("आगे ले जाया", "Carried forward")) : null}
              </tbody>
            </table>
            {last && result.note ? <p style={{ fontSize: "9pt" }}>{label(result.note)}</p> : null}
          </section>
        );
      })}
    </>
  );
}
