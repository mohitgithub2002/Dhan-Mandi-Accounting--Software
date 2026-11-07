import { sql } from "drizzle-orm";
import { db } from "@/db";
import { SettingsTabs } from "@/components/SettingsTabs";
import { Card, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePage } from "@/lib/server/auth";
import { getFirm } from "@/lib/server/core";
import { FirmForm } from "./FirmForm";

export default async function SettingsPage() {
  await requirePage("admin");
  const { t, tx } = await getI18n();
  const firm = await getFirm(db);
  const series = await db.execute<{ doc_type: string; label: string; next_no: number }>(sql`
    SELECT s.doc_type, f.label, s.next_no FROM number_series s JOIN financial_years f ON f.id = s.fy_id ORDER BY f.label DESC, s.doc_type`);
  return (
    <div>
      <PageHeader title={t("menu.settings")} />
      <SettingsTabs active="/settings" />
      <div className="flex flex-col gap-4">
        <Card title={tx("फर्म की जानकारी और प्रिंट", "Firm details and print")}>
          <FirmForm firm={{ ...firm, bhavWarnPct: firm.bhavWarnPct, cashLimit: firm.cashLimit }} />
        </Card>
        <Card title={tx("नंबर सीरीज़ (हर वित्त वर्ष में बिना गैप)", "Number series (gapless per financial year)")}>
          <Table>
            <thead>
              <tr>
                <th className={thCls}>{tx("दस्तावेज़", "Document")}</th>
                <th className={thCls}>{t("fy")}</th>
                <th className={thCls}>{tx("अगला नं.", "Next no.")}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={`${s.doc_type}-${s.label}`}>
                  <td className={tdCls}>{s.doc_type.replace(/^v_/, tx("वाउचर ", "voucher "))}</td>
                  <td className={tdCls}>{s.label}</td>
                  <td className={tdCls}>{s.next_no}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
