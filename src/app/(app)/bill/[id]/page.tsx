import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { raddDocAction } from "@/actions/entry";
import { RaddForm } from "@/components/ActionButtons";
import { EditSale } from "@/components/EditSale";
import { StatusBadge } from "@/components/StatusBadge";
import { Balance, Card, LinkButton, Money, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { db } from "@/db";
import { formatQtlKg } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/server/auth";
import { balanceOf } from "@/lib/server/ledger";
import { loadBill } from "@/lib/server/printdata";
import { salesForEdit } from "@/lib/server/queries";

export default async function BillView({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("reports_own");
  const { t, tx, lang } = await getI18n();
  const data = await loadBill(Number((await params).id));
  if (!data) notFound();
  const { b, vyapari, lines, charges } = data;
  const active = b.status === "active";
  const canEdit = active && (b.printCount === 0 ? can(actor.role, "entry") : can(actor.role, "edit_printed"));
  const sales = canEdit ? await salesForEdit(lines.map((l) => l.lotSaleId)) : {};
  const bal = await balanceOf(db, vyapari.id);
  const allocs = await db.execute<{ voucher_no: number; date: string; amount: string; voucher_id: number }>(sql`
    SELECT v.voucher_no, v.date::text AS date, a.amount, v.id AS voucher_id FROM bill_allocations a JOIN vouchers v ON v.id = a.receipt_voucher_id
    WHERE a.bill_id = ${b.id} ORDER BY v.date`);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${t("vyapariBill")} #${b.billNo}`}
        subtitle={`${formatDate(b.date)} · ${lang === "en" ? vyapari.nameEn || vyapari.nameHi : vyapari.nameHi || vyapari.nameEn}`}
        actions={
          <>
            <LinkButton href={`/print/bill/${b.id}`} target="_blank" variant="primary">
              {t("print")}
            </LinkButton>
            <LinkButton href={`/khata?account=${vyapari.id}`}>{t("khata")}</LinkButton>
          </>
        }
      />
      <div className="flex items-center gap-3">
        <StatusBadge status={b.status} />
        <span className="text-slate-600">{tx("देय तिथि", "Due")}: {formatDate(b.dueDate)}</span>
        {b.status === "radd" ? <span className="text-naam">{t("reason")}: {b.raddReason}</span> : null}
      </div>
      <Card title={t("dheri")}>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{t("kisan")}</th>
              <th className={thCls}>{t("jins")}</th>
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
                  {lang === "en" ? l.kisanEn || l.kisanHi : l.kisanHi || l.kisanEn}
                  {canEdit && sales[l.lotSaleId] ? <EditSale sale={sales[l.lotSaleId]} needReason={b.printCount > 0} /> : null}
                </td>
                <td className={tdCls}>{lang === "en" ? l.jinsEn : l.jinsHi}</td>
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
            <dd className="num"><Money value={b.amount} /></dd>
            {charges.map((c) => (
              <div key={c.id} className="contents">
                <dt>
                  + {lang === "en" ? c.nameEn : c.nameHi} {c.rateUsed ? `@ ${Number(c.rateUsed)}${c.basis.startsWith("pct") ? "%" : ""}` : ""}
                  {c.postMode === "show" ? ` (${tx("केवल सूचना", "info only")})` : ""}
                </dt>
                <dd className="num"><Money value={c.amount} /></dd>
              </div>
            ))}
            <dt>{tx("राउंड ऑफ", "Round off")}</dt>
            <dd className="num"><Money value={b.roundOff} /></dd>
            <dt className="text-lg font-bold">{t("billTotal")}</dt>
            <dd className="num text-lg font-bold text-naam"><Money value={b.total} /></dd>
          </dl>
        </Card>
        <Card title={tx("भुगतान और कार्रवाई", "Payments and actions")}>
          <p className="mb-2">
            {tx("व्यापारी का बाकी", "Vyapari balance")}: <Balance value={bal.toString()} lang={lang} />
          </p>
          {allocs.length ? (
            <ul className="mb-3 list-disc pl-5">
              {allocs.map((a) => (
                <li key={a.voucher_id}>
                  {tx("जमा", "Receipt")} #{a.voucher_no} · {formatDate(a.date)} · ₹<Money value={a.amount} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-slate-500">{tx("अभी कोई भुगतान नहीं", "No payment yet")}</p>
          )}
          {active && can(actor.role, "radd") ? (
            <RaddForm run={async (reason) => { "use server"; return raddDocAction({ docType: "bill", id: b.id, reason }); }} />
          ) : null}
        </Card>
      </div>
    </div>
  );
}
