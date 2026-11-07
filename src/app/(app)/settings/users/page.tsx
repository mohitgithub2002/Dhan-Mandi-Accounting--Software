import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SettingsTabs } from "@/components/SettingsTabs";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { requirePage } from "@/lib/server/auth";
import { UserEditor } from "./UserEditor";

export default async function UsersPage() {
  await requirePage("admin");
  const { t, tx } = await getI18n();
  const rows = await db.select({ id: users.id, name: users.name, mobile: users.mobile, role: users.role, lang: users.lang, active: users.active, lastLoginAt: users.lastLoginAt, lockedUntil: users.lockedUntil }).from(users).orderBy(asc(users.id));
  return (
    <div>
      <PageHeader title={t("menu.settings")} />
      <SettingsTabs active="/settings/users" />
      <Card title={tx("यूज़र और भूमिका", "Users and roles")}>
        <UserEditor rows={rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt?.toISOString() ?? null, locked: !!r.lockedUntil && r.lockedUntil > new Date() }))} />
      </Card>
    </div>
  );
}
