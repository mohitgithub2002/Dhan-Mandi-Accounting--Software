import { SettingsTabs } from "@/components/SettingsTabs";
import { Card, PageHeader } from "@/components/ui";
import { DICT } from "@/lib/i18n/dict";
import { getI18n } from "@/lib/i18n/server";
import { requirePage } from "@/lib/server/auth";
import { LabelEditor } from "./LabelEditor";

export default async function LabelsPage() {
  await requirePage("admin");
  const { t, tx, overrides } = await getI18n();
  const rows = Object.entries(DICT).map(([key, [hi, en]]) => ({ key, hi, en, oHi: overrides[key]?.hi ?? "", oEn: overrides[key]?.en ?? "" }));
  return (
    <div>
      <PageHeader title={t("menu.settings")} subtitle={tx("फर्म के अपने शब्द: खाली छोड़ें तो मूल शब्द दिखेगा", "Your firm's own words: leave blank to use the default")} />
      <SettingsTabs active="/settings/labels" />
      <Card>
        <LabelEditor rows={rows} />
      </Card>
    </div>
  );
}
