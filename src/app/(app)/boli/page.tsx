import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { db } from "@/db";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { getFirm } from "@/lib/server/core";
import { bhavBands, lotsForDate } from "@/lib/server/queries";
import { BoliSheet } from "./BoliSheet";

export default async function BoliPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const actor = await requirePage("entry");
  const { t, tx } = await getI18n();
  const date = await workingDate(actor);
  const sp = await searchParams;
  const firm = await getFirm(db);
  const [lots, bands] = await Promise.all([lotsForDate(date), bhavBands(date, firm.bhavWarnPct)]);
  const showAll = sp.all === "1";
  const rows = lots.filter((l) => (showAll ? l.status !== "parchi" : l.status === "aamad" || l.status === "boli") && l.sales.every((s) => !s.parchiId && !s.billId));
  return (
    <div>
      <PageHeader
        title={t("menu.boli")}
        subtitle={`${formatDate(date)} · ${tx("व्यापारी और भाव · Enter अगला · आख़िरी खाने पर Enter = सेव", "Vyapari and bhav · Enter next · Enter on last field saves")}`}
        actions={
          <a className="underline" href={showAll ? "/boli" : "/boli?all=1"}>
            {showAll ? tx("केवल बाकी", "Pending only") : tx("सभी ढेरी (सुधार)", "All lots (correct)")}
          </a>
        }
      />
      <BoliSheet lots={rows} bands={bands} />
    </div>
  );
}
