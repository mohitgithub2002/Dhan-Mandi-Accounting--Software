"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editSaleAction } from "@/actions/entry";
import { useI18n } from "@/lib/i18n/client";
import { Button, Field, Input, NumInput, Notice } from "./ui";

export interface SaleForEdit {
  id: number;
  bhav: string;
  bags: number;
  weighMode: string;
  grossKg: string;
  tarePerBagKg: string;
  moisturePct: string;
  dustKg: string;
}

/**
 * Edit bhav or weight of a sale on a parchi/bill. The server reverses and
 * re-posts the parchi and bill with the same numbers; printed ones need a reason.
 */
export function EditSale({ sale, needReason }: { sale: SaleForEdit; needReason: boolean }) {
  const { tx, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bhav, setBhav] = useState(sale.bhav);
  const [gross, setGross] = useState(sale.grossKg);
  const [bags, setBags] = useState(String(sale.bags));
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="text-sm text-brand-700 underline" onClick={() => setOpen(true)}>
        {tx("सुधार", "Edit")}
      </button>
    );
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
      <Field label={t("bhav")}>
        <NumInput className="w-28" value={bhav} onChange={(e) => setBhav(e.target.value)} />
      </Field>
      {sale.weighMode === "total" ? (
        <>
          <Field label={tx("बोरी", "Bags")}>
            <NumInput className="w-20" value={bags} onChange={(e) => setBags(e.target.value)} />
          </Field>
          <Field label={`${t("grossWeight")} kg`}>
            <NumInput className="w-32" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
        </>
      ) : null}
      <Field label={`${t("reason")}${needReason ? " *" : ""}`}>
        <Input className="w-56" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await editSaleAction({
              saleId: sale.id,
              bhav,
              tulai:
                sale.weighMode === "total"
                  ? { weighMode: "total", bags: Number(bags) || 0, grossKg: gross, tarePerBagKg: sale.tarePerBagKg, moisturePct: sale.moisturePct, dustKg: sale.dustKg }
                  : undefined,
              reason,
            });
            if (!r.ok) setErr(r.error);
            else {
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        {t("save")}
      </Button>
      <Button variant="secondary" onClick={() => setOpen(false)}>
        {tx("वापस", "Back")}
      </Button>
      {err ? <Notice kind="error">{err}</Notice> : null}
    </div>
  );
}
