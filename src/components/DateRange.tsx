"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Button, Field, Input } from "./ui";

/** From / to filter kept in the URL. */
export function DateRange({ from, to, disabled, children }: { from: string; to: string; disabled?: boolean; children?: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <form
      className="no-print mb-3 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const q = new URLSearchParams(sp.toString());
        for (const [k, v] of f.entries()) q.set(k, String(v));
        router.push(`${pathname}?${q.toString()}`);
      }}
    >
      <Field label={t("from")}>
        <Input type="date" name="from" defaultValue={from} disabled={disabled} />
      </Field>
      <Field label={t("to")}>
        <Input type="date" name="to" defaultValue={to} disabled={disabled} />
      </Field>
      {children}
      <Button type="submit" disabled={disabled}>
        {t("search")}
      </Button>
    </form>
  );
}
