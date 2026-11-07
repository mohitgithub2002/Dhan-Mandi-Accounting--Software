import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/server/auth";
import { REPORTS } from "@/lib/server/reports";

export default async function ReportList() {
  const actor = await requirePage("reports_own");
  const { t, tx, lang } = await getI18n();
  const list = REPORTS.filter((r) => can(actor.role, r.perm));
  return (
    <div>
      <PageHeader title={t("menu.report")} subtitle={tx("हर रिपोर्ट स्क्रीन पर, A4 प्रिंट और Excel में", "Every report on screen, A4 print and Excel")} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <Link key={r.key} href={r.href ?? `/report/${r.key}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-600">
            <div className="text-lg font-semibold text-brand-800">{lang === "en" ? r.en : r.hi}</div>
            <div className="text-slate-600">{lang === "en" ? r.descEn : r.descHi}</div>
          </Link>
        ))}
        {can(actor.role, "entry") && !can(actor.role, "reports") ? (
          <>
            <Link href="/parchi" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">{tx("आज की पर्चियां", "Today's parchis")}</Link>
            <Link href="/bill" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">{tx("आज के बिल", "Today's bills")}</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
