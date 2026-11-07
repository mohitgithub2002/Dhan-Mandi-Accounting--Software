"use client";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, tdCls, thCls } from "@/components/ui";
import { formatINR, formatQtlKg } from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";
import type { DayLot } from "@/lib/server/queries";

export function AamadList({ lots }: { lots: DayLot[] }) {
  const { t, tx, lang } = useI18n();
  if (!lots.length) return <p className="text-slate-500">{t("noData")}</p>;
  const nm = (hi: string | null, en: string | null) => (lang === "en" ? en || hi : hi || en) ?? "";
  return (
    <Table>
      <thead>
        <tr>
          <th className={thCls}>{tx("आमद", "Aamad")}</th>
          <th className={thCls}>{t("dheri")}</th>
          <th className={thCls}>{t("kisan")}</th>
          <th className={thCls}>{t("jins")}</th>
          <th className={`${thCls} text-right`}>{tx("बोरी", "Bags")}</th>
          <th className={thCls}>{t("vyapari")} · {t("bhav")}</th>
          <th className={`${thCls} text-right`}>{t("netWeight")}</th>
          <th className={`${thCls} text-right`}>{t("rakam")}</th>
          <th className={thCls}>{t("status")}</th>
        </tr>
      </thead>
      <tbody>
        {lots.map((l) => (
          <tr key={l.lotId}>
            <td className={tdCls}>
              #{l.arrivalNo}
              {l.vehicleNo ? <div className="text-sm text-slate-500">{l.vehicleNo}</div> : null}
            </td>
            <td className={tdCls}>{l.lotId}</td>
            <td className={tdCls}>
              {nm(l.kisanHi, l.kisanEn)}
              <div className="text-sm text-slate-500">{l.village}</div>
            </td>
            <td className={tdCls}>{nm(l.jinsHi, l.jinsEn)}</td>
            <td className={`${tdCls} num`}>{l.bags}</td>
            <td className={tdCls}>
              {l.sales
                .filter((s) => s.vyapariId)
                .map((s) => (
                  <div key={s.id}>
                    {nm(s.vyapariHi, s.vyapariEn)} · ₹{formatINR(s.bhav)} {l.sales.length > 1 ? `(${s.bags})` : ""}
                  </div>
                ))}
            </td>
            <td className={`${tdCls} num`}>{formatQtlKg(l.sales.reduce((a, s) => a + Number(s.netKg), 0), lang)}</td>
            <td className={`${tdCls} num`}>{formatINR(l.sales.reduce((a, s) => a + Number(s.amount), 0))}</td>
            <td className={tdCls}>
              <StatusBadge status={l.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
