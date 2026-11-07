import { raddVoucherAction } from "@/actions/money";
import { RaddForm } from "./ActionButtons";
import { StatusBadge } from "./StatusBadge";
import { Money, Table, tdCls, thCls } from "./ui";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can, type Role } from "@/lib/permissions";
import type { vouchersFor } from "@/lib/server/queries";

export const TYPE_LABEL: Record<string, [string, string]> = {
  parchi: ["पर्ची", "Parchi"],
  bill: ["बिल", "Bill"],
  jama: ["जमा", "Receipt"],
  naam: ["भुगतान", "Payment"],
  peshgi: ["पेशगी", "Peshgi"],
  kharcha: ["खर्चा", "Kharcha"],
  contra: ["कॉन्ट्रा", "Contra"],
  journal: ["जर्नल", "Journal"],
  byaj: ["ब्याज", "Byaj"],
  reversal: ["रिवर्सल", "Reversal"],
};

export async function VoucherList({ rows, role }: { rows: Awaited<ReturnType<typeof vouchersFor>>; role: Role }) {
  const { t, tx, lang } = await getI18n();
  if (!rows.length) return <p className="text-slate-500">{t("noData")}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className={thCls}>{tx("प्रकार", "Type")}</th>
          <th className={thCls}>{tx("नं.", "No.")}</th>
          <th className={thCls}>{t("date")}</th>
          <th className={thCls}>{tx("खाता", "Party")}</th>
          <th className={thCls}>{t("mode")}</th>
          <th className={`${thCls} text-right`}>{t("rakam")}</th>
          <th className={thCls}>{t("status")}</th>
          <th className={thCls} />
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id} className={v.status === "radd" ? "text-slate-400" : ""}>
            <td className={tdCls}>{TYPE_LABEL[v.type]?.[lang === "en" ? 1 : 0] ?? v.type}</td>
            <td className={tdCls}>{v.voucher_no}</td>
            <td className={tdCls}>{formatDate(v.date)}</td>
            <td className={tdCls}>
              {(lang === "en" ? v.party_en || v.party_hi : v.party_hi || v.party_en) ?? ""}
              <div className="text-sm text-slate-500">{v.narration}</div>
            </td>
            <td className={tdCls}>
              {v.mode} {v.ref_no ? <span className="text-sm text-slate-500">{v.ref_no}</span> : null}
            </td>
            <td className={`${tdCls} num`}><Money value={v.amount} /></td>
            <td className={tdCls}><StatusBadge status={v.status} /></td>
            <td className={tdCls}>
              <div className="flex flex-col items-start gap-1">
                <a className="underline" href={`/print/raseed/${v.id}`} target="_blank">
                  {t("raseed")}
                </a>
                {v.status === "active" && can(role, "radd") && v.type !== "reversal" ? (
                  <RaddForm run={async (reason) => { "use server"; return raddVoucherAction({ id: v.id, reason }); }} />
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
