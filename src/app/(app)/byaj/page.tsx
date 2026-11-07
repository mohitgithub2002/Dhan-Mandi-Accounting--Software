import { PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { db } from "@/db";
import { getFirm } from "@/lib/server/core";
import { ByajRun } from "./ByajRun";

/** Byaj run: calculate on daily balances, preview, post on approval (PRD §5.10). */
export default async function ByajPage() {
  const actor = await requirePage("byaj");
  const { t, tx } = await getI18n();
  const wd = await workingDate(actor);
  const firm = await getFirm(db);
  return (
    <div>
      <PageHeader
        title={t("byaj")}
        subtitle={tx(
          `दैनिक बाकी पर (डेली प्रोडक्ट): ब्याज = प्रोडक्ट × दर% ÷ 100 ÷ ${firm.byajDaysInMonth}`,
          `Daily product: byaj = product × rate% ÷ 100 ÷ ${firm.byajDaysInMonth}`,
        )}
      />
      <ByajRun defaultFrom={`${wd.slice(0, 8)}01`} defaultTo={wd} />
    </div>
  );
}
