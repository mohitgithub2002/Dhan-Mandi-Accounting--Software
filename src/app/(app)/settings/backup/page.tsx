import { asc } from "drizzle-orm";
import { db } from "@/db";
import { financialYears } from "@/db/schema";
import { ActButton } from "@/components/ActionButtons";
import { SettingsTabs } from "@/components/SettingsTabs";
import { Badge, Card, Notice, PageHeader, Table, tdCls, thCls } from "@/components/ui";
import { backupNow } from "@/actions/settings";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { requirePage } from "@/lib/server/auth";
import { listBackupFiles } from "@/lib/server/backup";
import { lastBackup } from "@/lib/server/queries";
import { FyLock } from "./FyLock";

export default async function BackupPage() {
  await requirePage("admin");
  const { t, tx } = await getI18n();
  const [files, last, years] = await Promise.all([listBackupFiles(), lastBackup(), db.select().from(financialYears).orderBy(asc(financialYears.startDate))]);
  const old = !last || Date.now() - last.at.getTime() > 24 * 3600 * 1000;
  return (
    <div>
      <PageHeader title={t("menu.settings")} />
      <SettingsTabs active="/settings/backup" />
      <div className="flex flex-col gap-4">
        <Card title={tx("बैकअप", "Backup")}>
          {old ? <Notice kind="error">{tx("बैकअप 24 घंटे से पुराना है", "Last backup is older than 24 hours")}</Notice> : null}
          <p className="my-2">
            {tx("आख़िरी बैकअप", "Last backup")}: {last ? `${last.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (${last.file})` : "—"}
          </p>
          <ActButton run={async () => { "use server"; return backupNow(); }} label={tx("अभी बैकअप लें", "Back up now")} />
          <p className="mt-2 text-sm text-slate-600">
            {tx(
              "फ़ाइल डाउनलोड करके पेन ड्राइव में रखें। हर घंटे का अपने-आप बैकअप Docker की backup सर्विस करती है।",
              "Download a file to keep it on a pen drive. Hourly automatic backups are run by the Docker backup service.",
            )}
          </p>
          <Table className="mt-3">
            <thead>
              <tr>
                <th className={thCls}>{tx("फ़ाइल", "File")}</th>
                <th className={thCls}>{tx("साइज़", "Size")}</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name}>
                  <td className={tdCls}>{f.name}</td>
                  <td className={tdCls}>{(f.size / 1024).toFixed(0)} KB</td>
                  <td className={tdCls}>
                    <a className="underline" href={`/api/backup/${f.name}`}>{tx("पेन ड्राइव के लिए डाउनलोड", "Download (pen drive)")}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title={tx("वित्त वर्ष", "Financial years")}>
          <Table>
            <thead>
              <tr>
                <th className={thCls}>{t("fy")}</th>
                <th className={thCls}>{t("from")}</th>
                <th className={thCls}>{t("to")}</th>
                <th className={thCls}>{t("status")}</th>
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td className={tdCls}>{y.label}</td>
                  <td className={tdCls}>{formatDate(y.startDate)}</td>
                  <td className={tdCls}>{formatDate(y.endDate)}</td>
                  <td className={tdCls}>{y.isLocked ? <Badge tone="red">{tx("बंद", "Locked")}</Badge> : <Badge tone="green">{tx("चालू", "Open")}</Badge>}</td>
                  <td className={tdCls}><FyLock id={y.id} locked={y.isLocked} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
