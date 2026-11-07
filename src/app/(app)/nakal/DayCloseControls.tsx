"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeDayAction, reopenDayAction } from "@/actions/books";
import { Button, Field, Input, Notice } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function DayCloseControls({ date, closed, canClose, canReopen }: { date: string; closed: boolean; canClose: boolean; canReopen: boolean }) {
  const { tx, t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "");
      else {
        setErr("");
        setReason("");
        router.refresh();
      }
    });
  return (
    <div className="flex flex-wrap items-end gap-2">
      {!closed && canClose ? (
        <Button variant="danger" disabled={pending} onClick={() => run(() => closeDayAction(date))}>
          🔒 {t("dinBand")}
        </Button>
      ) : null}
      {closed && canReopen ? (
        <>
          <Field label={`${tx("दिन खोलने का कारण", "Reason to reopen")}`}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button variant="secondary" disabled={pending || !reason.trim()} onClick={() => run(() => reopenDayAction({ date, reason }))}>
            {tx("दिन खोलें", "Reopen day")}
          </Button>
        </>
      ) : null}
      {err ? <Notice kind="error">{err}</Notice> : null}
    </div>
  );
}
