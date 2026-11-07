import { PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listCommodities } from "@/lib/server/queries";
import { DheriForm } from "./DheriForm";

export default async function DheriPage() {
  const actor = await requirePage("entry");
  const { t, tx } = await getI18n();
  const date = await workingDate(actor);
  const jins = await listCommodities();
  return (
    <div>
      <PageHeader
        title={t("menu.dheri")}
        subtitle={tx("आमद + बोली + तुलाई एक फ़ॉर्म में · Enter अगला खाना · Ctrl+S सेव · Ctrl+P सेव + पर्ची", "Aamad + boli + tulai in one form · Enter next field · Ctrl+S save · Ctrl+P save + parchi")}
      />
      <DheriForm date={date} jins={jins} />
    </div>
  );
}
