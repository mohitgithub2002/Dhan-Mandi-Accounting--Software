"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPeshgiAction } from "@/actions/entry";
import { Button, Field, Input, NumInput, Notice } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

/** Munim chooses how much peshgi to recover on this parchi (PRD §5.5, §14). */
export function PeshgiForm({ id, current, needReason }: { id: number; current: string; needReason: boolean }) {
  const { tx, t } = useI18n();
  const router = useRouter();
  const [amount, setAmount] = useState(current);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={tx("पेशगी वसूली ₹", "Peshgi recovered ₹")}>
        <NumInput className="w-36" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {needReason ? (
        <Field label={`${t("reason")} *`}>
          <Input className="w-48" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      ) : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setPeshgiAction({ id, amount, reason });
            setMsg(r.ok ? { kind: "ok", text: "✓" } : { kind: "error", text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        {t("save")}
      </Button>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    </div>
  );
}
