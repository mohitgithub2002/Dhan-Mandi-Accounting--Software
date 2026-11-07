"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function ReportFilters({ from, to, asOf, groups, group }: { from: string; to: string; asOf: boolean; groups: { value: string; hi: string; en: string }[]; group?: string }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [tt, setTt] = useState(to);
  const [g, setG] = useState(group ?? "");
  return (
    <form
      className="no-print flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new URLSearchParams({ from: f, to: tt, ...(g ? { group: g } : {}) });
        router.push(`${pathname}?${q}`);
      }}
    >
      {!asOf ? (
        <Field label={t("from")}>
          <Input type="date" value={f} onChange={(e) => setF(e.target.value)} />
        </Field>
      ) : null}
      <Field label={asOf ? tx("तारीख़ तक", "As of") : t("to")}>
        <Input type="date" value={tt} onChange={(e) => setTt(e.target.value)} />
      </Field>
      {groups.length ? (
        <Field label={tx("दिखाएं", "Show")}>
          <Select value={g} onChange={(e) => setG(e.target.value)}>
            {groups.map((x) => (
              <option key={x.value} value={x.value}>
                {lang === "en" ? x.en : x.hi}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Button type="submit">{t("search")}</Button>
    </form>
  );
}
