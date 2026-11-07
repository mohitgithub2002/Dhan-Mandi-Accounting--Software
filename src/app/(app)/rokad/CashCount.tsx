"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cashCountAction } from "@/actions/books";
import { Button, Field, NumInput, Notice } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function CashCount({ date, current }: { date: string; current: string }) {
  const { tx, t } = useI18n();
  const router = useRouter();
  const [amount, setAmount] = useState(current);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={tx("गल्ले में नकद ₹", "Cash in hand ₹")}>
        <NumInput className="w-40" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cashCountAction({ date, amount });
            if (!r.ok) setErr(r.error);
            else router.refresh();
          })
        }
      >
        {t("save")}
      </Button>
      {err ? <Notice kind="error">{err}</Notice> : null}
    </div>
  );
}
