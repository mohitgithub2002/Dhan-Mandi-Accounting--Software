import { notFound } from "next/navigation";
import { raddDocAction } from "@/actions/entry";
import { RaddForm } from "@/components/ActionButtons";
import { EditSale } from "@/components/EditSale";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, LinkButton, Money, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { formatQtlKg } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/server/auth";
import { balanceOf } from "@/lib/server/ledger";
import { loadParchi } from "@/lib/server/printdata";
import { salesForEdit } from "@/lib/server/queries";
import { db } from "@/db";
import { Balance } from "@/components/ui";
import { PeshgiForm } from "./PeshgiForm";

export default async function ParchiView({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("reports_own");
  const { t, tx, lang } = await getI18n();
  const data = await loadParchi(Number((await params).id));
  if (!data) notFound();
  const { p, kisan, lines, charges } = data;
  const active = p.status === "active";
  const canEdit = active && (p.printCount === 0 ? can(actor.role, "entry") : can(actor.role, "edit_printed"));
  const sales = canEdit ? await salesForEdit(lines.map((l) => l.lotSaleId)) : {};
  const kisanBal = await balanceOf(db, kisan.id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${t("kisanParchi")} #${p.parchiNo}`}
        subtitle={`${formatDate(p.date)} · ${lang === "en" ? kisan.nameEn || kisan.nameHi : kisan.nameHi || kisan.nameEn} · ${kisan.village}`}
        actions={
          <>
            <LinkButton href={`/print/parchi/${p.id}`} target="_blank" variant="primary">
              {t("print")} {p.printCount ? `(${tx("नकल", "nakal")})` : ""}
            </LinkButton>
            <LinkButton href={`/khata?account=${kisan.id}`}>{t("khata")}</LinkButton>
          </>
        }
      />
      <div className="flex items-center gap-3">
        <StatusBadge status={p.status} />
        <span className="text-slate-600">
          {tx("प्रिंट", "Prints")}: {p.printCount}
        </span>
        {p.status === "radd" ? <span className="text-naam">{t("reason")}: {p.raddReason}</span> : null}
      </div>
      <Card title={t("dheri")}>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{t("jins")}</th>
              <th className={thCls}>{t("vyapari")}</th>
              <th className={`${thCls} text-right`}>{tx("बोरी", "Bags")}</th>
              <th className={`${thCls} text-right`}>{t("netWeight")}</th>
              <th className={`${thCls} text-right`}>{t("bhav")}</th>
              <th className={`${thCls} text-right`}>{t("rakam")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className={tdCls}>
                  {lang === "en" ? l.jinsEn : l.jinsHi}
                  {canEdit && sales[l.lotSaleId] ? <EditSale sale={sales[l.lotSaleId]} needReason={p.printCount > 0} /> : null}
                </td>
                <td className={tdCls}>{lang === "en" ? l.vyapariEn || l.vyapariHi : l.vyapariHi || l.vyapariEn}</td>
                <td className={`${tdCls} num`}>{l.bags}</td>
                <td className={`${tdCls} num`}>{formatQtlKg(l.netKg, lang)}</td>
                <td className={`${tdCls} num`}><Money value={l.bhav} /></td>
                <td className={`${tdCls} num`}><Money value={l.amount} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("kharcha")}>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1">
            <dt>{t("rakam")}</dt>
            <dd className="num"><Money value={p.grossAmount} /></dd>
            {charges.map((c) => (
              <div key={c.id} className="contents">
                <dt>
                  − {lang === "en" ? c.nameEn : c.nameHi} {c.rateUsed ? `@ ${Number(c.rateUsed)}${c.basis.startsWith("pct") ? "%" : ""}` : ""}
                  {c.postMode === "show" ? " *" : ""}
                </dt>
                <dd className="num"><Money value={c.amount} /></dd>
              </div>
            ))}
            <dt>{tx("राउंड ऑफ", "Round off")}</dt>
            <dd className="num"><Money value={p.roundOff} /></dd>
            <dt className="font-bold">{tx("शुद्ध (खाते में जमा)", "Net (to khata)")}</dt>
            <dd className="num font-bold"><Money value={p.netAmount} /></dd>
            <dt>{tx("पेशगी वसूली", "Peshgi recovered")}</dt>
            <dd className="num"><Money value={p.peshgiRecovered} /></dd>
            <dt className="text-lg font-bold">{t("netPayable")}</dt>
            <dd className="num text-lg font-bold text-jama"><Money value={p.payableAmount} /></dd>
          </dl>
        </Card>
        <Card title={tx("कार्रवाई", "Actions")}>
          <p className="mb-3">
            {tx("किसान का बाकी", "Kisan balance")}: <Balance value={kisanBal.toString()} lang={lang} />
          </p>
          {active && can(actor.role, "entry") ? <PeshgiForm id={p.id} current={p.peshgiRecovered} needReason={p.printCount > 0} /> : null}
          {active && can(actor.role, "radd") ? (
            <div className="mt-3">
              <RaddForm run={async (reason) => { "use server"; return raddDocAction({ docType: "parchi", id: p.id, reason }); }} />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
