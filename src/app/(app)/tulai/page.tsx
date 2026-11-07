import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { lotsForDate } from "@/lib/server/queries";
import { TulaiSheet, type TulaiRowData } from "./TulaiSheet";

export default async function TulaiPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const actor = await requirePage("entry");
  const { t, tx, lang } = await getI18n();
  const date = await workingDate(actor);
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const lots = await lotsForDate(date);
  const rows: TulaiRowData[] = [];
  for (const l of lots) {
    for (const s of l.sales) {
      if (!s.vyapariId || !s.bhav || s.parchiId || s.billId) continue;
      if (!showAll && Number(s.netKg) > 0) continue;
      rows.push({
        saleId: s.id,
        lotId: l.lotId,
        kisan: lang === "en" ? l.kisanEn || l.kisanHi : l.kisanHi || l.kisanEn,
        jins: lang === "en" ? l.jinsEn : l.jinsHi,
        vyapari: (lang === "en" ? s.vyapariEn || s.vyapariHi : s.vyapariHi || s.vyapariEn) ?? "",
        bhav: s.bhav,
        bags: String(s.bags),
        weighMode: s.weighMode as "total" | "bagwise",
        grossKg: Number(s.grossKg) ? s.grossKg : "",
        bagKgs: s.bagKgs,
        tarePerBagKg: s.tarePerBagKg,
        moisturePct: s.moisturePct,
        dustKg: s.dustKg,
        netKg: s.netKg,
      });
    }
  }
  return (
    <div>
      <PageHeader
        title={t("menu.tulai")}
        subtitle={`${formatDate(date)} · ${tx("वज़न, बोरी और कटौती", "Weights, bags and katauti")}`}
        actions={
          <a className="underline" href={showAll ? "/tulai" : "/tulai?all=1"}>
            {showAll ? tx("केवल बाकी", "Pending only") : tx("सभी (सुधार)", "All (correct)")}
          </a>
        }
      />
      <TulaiSheet rows={rows} />
    </div>
  );
}
