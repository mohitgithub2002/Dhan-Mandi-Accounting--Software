import { asc } from "drizzle-orm";
import { db } from "@/db";
import { commodities } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/server/auth";
import { JinsEditor } from "./JinsEditor";

export default async function JinsPage() {
  const actor = await requirePage("reports");
  const { t, tx } = await getI18n();
  const rows = await db.select().from(commodities).orderBy(asc(commodities.seq), asc(commodities.id));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`${t("jins")} ${tx("मास्टर", "master")}`} subtitle={tx("मंडी शुल्क समूह: A = 1.60%, B = 1.00%, C = 0.50% (नई जिंस पर शुल्क दर अपने आप)", "Fee group: A = 1.60%, B = 1.00%, C = 0.50% (a new jins gets its shulk rate automatically)")} />
      <Card>
        <JinsEditor rows={rows.map((r) => ({ ...r, mspRate: r.mspRate ?? "" }))} canEdit={can(actor.role, "jins_master")} />
      </Card>
    </div>
  );
}
