import { Balance, Money, Table, tdCls, thCls } from "./ui";
import { TYPE_LABEL } from "./VoucherList";
import { formatDate } from "@/lib/dates";
import type { LedgerRow } from "@/lib/server/queries";

/** Ledger lines with jama / naam columns and running balance with side; drill-down links. */
export function LedgerTable({
  data,
  lang,
  labels,
  links = true,
}: {
  data: { opening: string; entries: LedgerRow[]; closing: string; totalDebit: string; totalCredit: string };
  lang: "hi" | "en";
  labels: { date: string; type: string; narration: string; naam: string; jama: string; balance: string; opening: string; closing: string; total: string };
  links?: boolean;
}) {
  const href = (r: LedgerRow) =>
    r.docType === "parchi" ? `/parchi/${r.docId}` : r.docType === "bill" ? `/bill/${r.docId}` : `/print/raseed/${r.voucherId}`;
  return (
    <Table>
      <thead>
        <tr>
          <th className={thCls}>{labels.date}</th>
          <th className={thCls}>{labels.type}</th>
          <th className={thCls}>{labels.narration}</th>
          <th className={`${thCls} text-right text-naam`}>{labels.naam}</th>
          <th className={`${thCls} text-right text-jama`}>{labels.jama}</th>
          <th className={`${thCls} text-right`}>{labels.balance}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="bg-slate-50">
          <td className={tdCls} colSpan={5}>
            <b>{labels.opening}</b>
          </td>
          <td className={`${tdCls} text-right`}>
            <Balance value={data.opening} lang={lang} />
          </td>
        </tr>
        {data.entries.map((r) => (
          <tr key={r.id} className={r.status === "radd" || r.type === "reversal" ? "text-slate-500" : ""}>
            <td className={tdCls}>{formatDate(r.date)}</td>
            <td className={tdCls}>
              {links ? (
                <a className="text-brand-700 underline" href={href(r)}>
                  {TYPE_LABEL[r.type]?.[lang === "en" ? 1 : 0] ?? r.type} {r.voucherNo}
                </a>
              ) : (
                `${TYPE_LABEL[r.type]?.[lang === "en" ? 1 : 0] ?? r.type} ${r.voucherNo}`
              )}
            </td>
            <td className={tdCls}>{r.narration}</td>
            <td className={`${tdCls} num text-naam`}>{Number(r.debit) ? <Money value={r.debit} /> : ""}</td>
            <td className={`${tdCls} num text-jama`}>{Number(r.credit) ? <Money value={r.credit} /> : ""}</td>
            <td className={`${tdCls} text-right`}>
              <Balance value={r.balance} lang={lang} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="font-bold">
          <td className={tdCls} colSpan={3}>
            {labels.total}
          </td>
          <td className={`${tdCls} num text-naam`}>
            <Money value={data.totalDebit} />
          </td>
          <td className={`${tdCls} num text-jama`}>
            <Money value={data.totalCredit} />
          </td>
          <td className={tdCls} />
        </tr>
        <tr className="bg-slate-50 font-bold">
          <td className={tdCls} colSpan={5}>
            {labels.closing}
          </td>
          <td className={`${tdCls} text-right`}>
            <Balance value={data.closing} lang={lang} />
          </td>
        </tr>
      </tfoot>
    </Table>
  );
}
