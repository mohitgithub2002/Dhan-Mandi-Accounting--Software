import { db } from "@/db";
import { Shell } from "@/components/Shell";
import { AppProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { requirePage, workingDate } from "@/lib/server/auth";
import { getFirm, getFy, isDayClosed } from "@/lib/server/core";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePage();
  const { lang, overrides } = await getI18n();
  const wd = await workingDate(actor);
  const firm = await getFirm(db);
  const fy = await getFy(db, wd, { forPosting: false });
  const closed = await isDayClosed(db, wd);
  return (
    <AppProvider lang={lang} overrides={overrides} role={actor.role} workingDate={wd}>
      <Shell
        firmName={lang === "en" ? firm.nameEn || firm.nameHi : firm.nameHi || firm.nameEn}
        userName={actor.name}
        role={actor.role}
        fyLabel={fy.label}
        dayClosed={closed}
      >
        {children}
      </Shell>
    </AppProvider>
  );
}
