"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/server/errors";
import { useI18n } from "@/lib/i18n/client";
import { Button, Field, Input, Notice } from "./ui";

/** Button that runs a server action and shows the result. */
export function ActButton({
  run,
  label,
  variant = "primary",
  confirmText,
  onDone,
}: {
  run: () => Promise<ActionResult<unknown>>;
  label: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success";
  confirmText?: string;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant={variant}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            const r = await run();
            if (!r.ok) setErr(r.error);
            else {
              setErr("");
              onDone?.(r.data);
              router.refresh();
            }
          });
        }}
      >
        {label}
      </Button>
      {err ? <span className="text-sm text-naam">{err}</span> : null}
    </span>
  );
}

/** Radd (cancel) with a required reason — the only confirmation in the app (PRD §9 rule 9). */
export function RaddForm({ run }: { run: (reason: string) => Promise<ActionResult<unknown>> }) {
  const { tx, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t("radd")}
      </Button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3">
      <Field label={`${t("radd")} — ${t("reason")}`}>
        <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {err ? <Notice kind="error">{err}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {tx("वापस", "Back")}
        </Button>
        <Button
          variant="danger"
          disabled={pending || !reason.trim()}
          onClick={() => {
            if (!window.confirm(tx("पक्का रद्द करें?", "Really cancel?"))) return;
            start(async () => {
              const r = await run(reason);
              if (!r.ok) setErr(r.error);
              else {
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          {tx("रद्द करें", "Cancel it")}
        </Button>
      </div>
    </div>
  );
}
