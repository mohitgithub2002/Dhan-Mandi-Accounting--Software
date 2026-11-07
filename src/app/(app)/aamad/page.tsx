import { Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listCommodities, lotsForDate } from "@/lib/server/queries";
import { AamadForm } from "./AamadForm";
import { AamadList } from "./AamadList";

export default async function AamadPage() {
  const actor = await requirePage("entry");
  const { t, tx } = await getI18n();
  const date = await workingDate(actor);
  const [jins, lots] = await Promise.all([listCommodities(), lotsForDate(date)]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("menu.aamad")} subtitle={`${formatDate(date)} · ${tx("किसान की फसल दुकान पर आई", "Produce arrived at the shop")}`} />
      <Card title={tx("नई आमद", "New arrival")}>
        <AamadForm date={date} jins={jins} />
      </Card>
      <Card title={tx("आज की आमद", "Today's arrivals")}>
        <AamadList lots={lots} />
      </Card>
    </div>
  );
}
