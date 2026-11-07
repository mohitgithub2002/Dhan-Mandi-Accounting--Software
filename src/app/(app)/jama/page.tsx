import { Card, PageHeader } from "@/components/ui";
import { VoucherList } from "@/components/VoucherList";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listAccountsByType, vouchersFor } from "@/lib/server/queries";
import { JamaForm } from "./JamaForm";

export default async function JamaPage() {
  const actor = await requirePage("jama_naam");
  const { t, tx } = await getI18n();
  const date = await workingDate(actor);
  const [banks, rows] = await Promise.all([listAccountsByType(["bank"]), vouchersFor(date, date, ["jama"])]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("menu.jama")} subtitle={`${formatDate(date)} · ${tx("व्यापारी या किसी से पैसा आया", "Money received from a vyapari or anyone")}`} />
      <Card>
        <JamaForm date={date} banks={banks} />
      </Card>
      <Card title={tx("आज की जमा", "Today's receipts")}>
        <VoucherList rows={rows} role={actor.role} />
      </Card>
    </div>
  );
}
