"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveShulkReturn } from "@/actions/settings";
import { Button, Field, Input, NumInput, Notice } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function ShulkReturnForm({ from, to, amount }: { from: string; to: string; amount: string }) {
  const { tx } = useI18n();
  const router = useRouter();
  const [challanNo, setNo] = useState("");
  const [challanDate, setDate] = useState(to);
  const [amt, setAmt] = useState(Number(amount).toFixed(2));
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={tx("चालान नं.", "Challan no.")}>
        <Input value={challanNo} onChange={(e) => setNo(e.target.value)} />
      </Field>
      <Field label={tx("चालान तारीख़", "Challan date")}>
        <Input type="date" value={challanDate} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={tx("रकम", "Amount")}>
        <NumInput value={amt} onChange={(e) => setAmt(e.target.value)} />
      </Field>
      <Button
        disabled={pending || !challanNo}
        onClick={() =>
          start(async () => {
            const r = await saveShulkReturn({ periodFrom: from, periodTo: to, challanNo, challanDate, amount: amt });
            if (!r.ok) setErr(r.error);
            else {
              setErr("");
              setNo("");
              router.refresh();
            }
          })
        }
      >
        {tx(`${from} – ${to} को जमा दर्ज करें`, `Mark ${from} – ${to} as filed`)}
      </Button>
      {err ? <Notice kind="error">{err}</Notice> : null}
    </div>
  );
}
