import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { chargeHeads } from "@/db/schema";
import { Badge, Card, LinkButton, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listCommodities } from "@/lib/server/queries";
import { BASIS_LABEL, PAYER_LABEL, POST_LABEL } from "@/lib/chargeLabels";
import { TestCalc } from "./TestCalc";

export default async function KharchaMaster() {
  const actor = await requirePage("reports");
  const { tx, lang } = await getI18n();
  const wd = await workingDate(actor);
  const heads = await db.select().from(chargeHeads).orderBy(asc(chargeHeads.seq), asc(chargeHeads.id));
  const rates = await db.execute<{ charge_head_id: number; rate: string; jins: string | null; party: string | null }>(sql`
    SELECT r.charge_head_id, r.rate, c.name_hi AS jins, a.name_hi AS party FROM charge_rates r
    LEFT JOIN commodities c ON c.id = r.commodity_id LEFT JOIN accounts a ON a.id = r.account_id
    WHERE r.effective_from <= ${wd} AND (r.effective_to IS NULL OR r.effective_to >= ${wd})
    ORDER BY r.account_id NULLS FIRST, c.seq NULLS FIRST`);
  const jins = await listCommodities();
  const L = (m: Record<string, [string, string]>, k: string) => m[k]?.[lang === "en" ? 1 : 0] ?? k;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={tx("खर्चा / टैक्स मास्टर", "Kharcha / tax master")}
        subtitle={tx("कुछ भी हार्ड-कोड नहीं: हर खर्चा यहां से। दर बदलने पर पुरानी पर्ची/बिल नहीं बदलते।", "Nothing is hard-coded. A rate change never alters a printed parchi or bill.")}
        actions={can(actor.role, "rate_master") ? <LinkButton variant="primary" href="/master/kharcha/new">+ {tx("नई लाइन", "New line")}</LinkButton> : null}
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{tx("क्रम", "Kram")}</th>
              <th className={thCls}>{tx("खर्चा", "Line")}</th>
              <th className={thCls}>{tx("आधार", "Basis")}</th>
              <th className={thCls}>{tx("कौन देगा", "Paid by")}</th>
              <th className={thCls}>{tx("कहां जाएगा", "Posts to")}</th>
              <th className={thCls}>{tx("आज की दर", "Rate today")}</th>
              <th className={thCls}>{tx("स्थिति", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => {
              const active = h.activeFrom <= wd && (!h.activeTo || h.activeTo > wd);
              const rs = rates.filter((r) => Number(r.charge_head_id) === h.id);
              return (
                <tr key={h.id} className={active ? "" : "text-slate-400"}>
                  <td className={tdCls}>{h.seq}</td>
                  <td className={tdCls}>
                    <Link className="font-medium text-brand-700 underline" href={`/master/kharcha/${h.id}`}>
                      {lang === "en" ? h.nameEn : h.nameHi}
                    </Link>
                    <div className="text-sm text-slate-500">
                      {h.code} · {h.kind} · {h.saleType}
                    </div>
                  </td>
                  <td className={tdCls}>{L(BASIS_LABEL, h.basis)}</td>
                  <td className={tdCls}>
                    {L(PAYER_LABEL, h.payer)}
                    {h.payer === "split" ? ` (${tx("किसान", "kisan")} ${Number(h.splitKisanPct)}%)` : ""}
                  </td>
                  <td className={tdCls}>{L(POST_LABEL, h.postMode)}</td>
                  <td className={tdCls}>
                    {rs.length === 0 ? <Badge tone="amber">{tx("दर नहीं डाली", "no rate")}</Badge> : null}
                    {rs.slice(0, 4).map((r, i) => (
                      <div key={i} className="text-sm">
                        {Number(r.rate)}
                        {h.basis.startsWith("pct") ? "%" : " ₹"} {r.jins ? `· ${r.jins}` : ""} {r.party ? <Badge tone="blue">{r.party}</Badge> : null}
                      </div>
                    ))}
                    {rs.length > 4 ? <div className="text-sm text-slate-500">+{rs.length - 4}</div> : null}
                  </td>
                  <td className={tdCls}>{active ? <Badge tone="green">{tx("चालू", "Active")}</Badge> : <Badge>{tx("बंद", "Inactive")}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Card title={tx("जांच: नमूना ढेरी पर पर्ची और बिल", "Test: parchi and bill for a sample dheri")}>
        <TestCalc jins={jins} date={wd} />
      </Card>
    </div>
  );
}
