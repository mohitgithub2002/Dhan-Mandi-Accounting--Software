import Link from "next/link";
import { Card, PageHeader, cx } from "@/components/ui";
import { VoucherList } from "@/components/VoucherList";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { listAccountsByType, vouchersFor } from "@/lib/server/queries";
import { NaamForm, type Tab } from "./NaamForm";

export default async function NaamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePage("jama_naam");
  const { t, tx } = await getI18n();
  const date = await workingDate(actor);
  const sp = await searchParams;
  const tab: Tab = (["naam", "peshgi", "kharcha", "contra"] as const).find((x) => x === sp.tab) ?? "naam";
  const [banks, heads, cash, rows] = await Promise.all([
    listAccountsByType(["bank"]),
    listAccountsByType(["expense", "payable", "labour", "transporter"]),
    listAccountsByType(["cash"]),
    vouchersFor(date, date, ["naam", "peshgi", "kharcha", "contra"]),
  ]);
  const tabs: [Tab, string][] = [
    ["naam", tx("किसान को भुगतान", "Pay kisan")],
    ["peshgi", t("peshgi")],
    ["kharcha", tx("खर्चा भुगतान", "Kharcha payment")],
    ["contra", tx("कॉन्ट्रा (नकद ⇄ बैंक)", "Contra (cash ⇄ bank)")],
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("menu.naam")} subtitle={formatDate(date)} />
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/naam?tab=${k}`} className={cx("rounded-md border px-4 py-2", tab === k ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white")}>
            {label}
          </Link>
        ))}
      </div>
      <Card>
        <NaamForm key={tab} tab={tab} date={date} banks={banks} heads={heads.filter((h) => h.code !== "ROUND_OFF")} cashId={cash.find((c) => c.code === "CASH")?.id ?? 0} />
      </Card>
      <Card title={tx("आज के भुगतान", "Today's payments")}>
        <VoucherList rows={rows} role={actor.role} />
      </Card>
    </div>
  );
}
