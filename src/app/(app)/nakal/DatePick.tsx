"use client";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function DatePick({ date }: { date: string }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Field label={t("date")}>
      <Input type="date" value={date} onChange={(e) => router.push(`?date=${e.target.value}`)} />
    </Field>
  );
}
