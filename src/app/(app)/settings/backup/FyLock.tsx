"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFyLock } from "@/actions/settings";
import { Button, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function FyLock({ id, locked }: { id: number; locked: boolean }) {
  const { tx } = useI18n();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const go = (lock: boolean) =>
    start(async () => {
      const r = await setFyLock({ id, locked: lock, reason });
      if (!r.ok) setErr(r.error);
      else router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {locked ? (
        <>
          <Input className="min-h-9 w-48 py-1" placeholder={tx("खोलने का कारण", "Reason to unlock")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="secondary" className="min-h-9 py-1" disabled={pending} onClick={() => go(false)}>{tx("खोलें", "Unlock")}</Button>
        </>
      ) : (
        <Button variant="danger" className="min-h-9 py-1" disabled={pending} onClick={() => window.confirm(tx("वर्ष बंद करें?", "Lock this year?")) && go(true)}>
          {tx("वर्ष बंद करें", "Lock year")}
        </Button>
      )}
      {err ? <span className="text-sm text-naam">{err}</span> : null}
    </div>
  );
}
