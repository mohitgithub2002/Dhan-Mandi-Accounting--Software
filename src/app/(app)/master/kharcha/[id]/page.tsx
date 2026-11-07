import { asc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { chargeHeads } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listAccountsByType, listCommodities } from "@/lib/server/queries";
import { HeadForm, type HeadData } from "./HeadForm";
import { RateEditor } from "./RateEditor";

export default async function HeadPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("reports");
  const { tx, lang } = await getI18n();
  const { id } = await params;
  const wd = await workingDate(actor);
  const isNew = id === "new";
  const [h] = isNew ? [null] : await db.select().from(chargeHeads).where(eq(chargeHeads.id, Number(id)));
  if (!isNew && !h) notFound();
  const others = await db.select({ id: chargeHeads.id, nameHi: chargeHeads.nameHi, nameEn: chargeHeads.nameEn }).from(chargeHeads).orderBy(asc(chargeHeads.seq));
  const postAccounts = await listAccountsByType(["income", "payable", "labour", "expense", "other"]);
  const jins = await listCommodities(false);
  const rates = h
    ? await db.execute<{ id: number; rate: string; effective_from: string; effective_to: string | null; commodity_id: number | null; account_id: number | null; jins: string | null; party: string | null; by: string | null }>(sql`
        SELECT r.id, r.rate, r.effective_from::text, r.effective_to::text, r.commodity_id, r.account_id, c.name_hi AS jins, a.name_hi AS party, u.name AS by
        FROM charge_rates r LEFT JOIN commodities c ON c.id = r.commodity_id LEFT JOIN accounts a ON a.id = r.account_id LEFT JOIN users u ON u.id = r.created_by
        WHERE r.charge_head_id = ${h.id} ORDER BY r.account_id NULLS FIRST, c.seq NULLS FIRST, r.effective_from DESC`)
    : [];
  const canEdit = can(actor.role, "rate_master");
  const data: HeadData = h
    ? { ...h, refHeadId: h.refHeadId, postAccountId: h.postAccountId, splitKisanPct: h.splitKisanPct }
    : {
        code: "", nameHi: "", nameEn: "", kind: "kharcha", basis: "pct_amount", refHeadId: null, payer: "vyapari", splitKisanPct: "50", saleType: "private",
        allowPartyOverride: true, postMode: "income", postAccountId: null, seq: (others.length + 1) * 10, rounding: "none", onParchi: true, onBill: true,
        printLabelHi: "", printLabelEn: "", activeFrom: wd, activeTo: null,
      };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={isNew ? tx("नई खर्चा लाइन", "New kharcha line") : `${lang === "en" ? h!.nameEn : h!.nameHi} (${h!.code})`} />
      <Card>
        <HeadForm data={data} others={others.filter((o) => o.id !== h?.id)} postAccounts={postAccounts} canEdit={canEdit} today={wd} />
      </Card>
      {h ? (
        <Card title={tx("दर इतिहास और ओवरराइड", "Rate history and overrides")}>
          <RateEditor
            headId={h.id}
            pct={h.basis.startsWith("pct")}
            rates={rates.map((r) => ({ id: Number(r.id), rate: r.rate, from: r.effective_from, to: r.effective_to, jins: r.jins, party: r.party, by: r.by }))}
            jins={jins.map((j) => ({ id: j.id, name: lang === "en" ? j.nameEn : j.nameHi }))}
            canEdit={canEdit}
            allowOverride={h.allowPartyOverride}
            today={wd}
          />
        </Card>
      ) : null}
    </div>
  );
}
