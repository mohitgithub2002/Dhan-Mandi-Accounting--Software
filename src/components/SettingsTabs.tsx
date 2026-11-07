import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { cx } from "./ui";

export async function SettingsTabs({ active }: { active: string }) {
  const { tx } = await getI18n();
  const tabs = [
    ["/settings", tx("फर्म और प्रिंट", "Firm and print")],
    ["/settings/users", tx("यूज़र", "Users")],
    ["/settings/labels", tx("शब्द (लेबल)", "Shabd (labels)")],
    ["/settings/backup", tx("बैकअप और वर्ष", "Backup and years")],
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} className={cx("rounded-md border px-4 py-2", active === href ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white")}>
          {label}
        </Link>
      ))}
    </div>
  );
}
