import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePage } from "@/lib/server/auth";

export default async function MasterHub() {
  await requirePage("reports");
  const { t, tx } = await getI18n();
  const items = [
    { href: "/master/party", title: tx("खाता (पार्टी) मास्टर", "Party (khata) master"), desc: tx("किसान, व्यापारी, एजेंसी, बैंक, पल्लेदार, खर्चे", "Kisan, vyapari, agency, bank, labour, expense heads") },
    { href: "/master/jins", title: tx("जिंस मास्टर", "Jins master"), desc: tx("जिंस, HSN, मंडी शुल्क समूह, बोरी वज़न", "Commodity, HSN, fee group, bag weight") },
    { href: "/master/kharcha", title: tx("खर्चा / टैक्स मास्टर", "Kharcha / tax master"), desc: tx("हर खर्चा और शुल्क, दर इतिहास, जांच", "Every charge and fee, rate history, test") },
  ];
  return (
    <div>
      <PageHeader title={t("menu.master")} />
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-600">
            <div className="text-lg font-semibold text-brand-800">{i.title}</div>
            <div className="text-slate-600">{i.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
