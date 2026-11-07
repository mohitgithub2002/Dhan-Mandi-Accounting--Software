"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

export function KhataPicker({ party, from, to, byaj }: { party: PartyHit | null; from: string; to: string; byaj: boolean }) {
  const { t, tx } = useI18n();
  const router = useRouter();
  const [p, setP] = useState<PartyHit | null>(party);
  const [f, setF] = useState(from);
  const [tt, setTt] = useState(to);
  const [b, setB] = useState(byaj);
  const go = (pp = p) => pp && router.push(`/khata?account=${pp.id}&from=${f}&to=${tt}${b ? "&byaj=1" : ""}`);
  return (
    <form
      className="no-print flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <Field label={`${t("khata")} (F2)`} className="min-w-80 flex-1">
        <PartySearch types={[]} value={p} onChange={(v) => setP(v)} autoFocus={!party} />
      </Field>
      <Field label={t("from")}>
        <Input type="date" value={f} onChange={(e) => setF(e.target.value)} />
      </Field>
      <Field label={t("to")}>
        <Input type="date" value={tt} onChange={(e) => setTt(e.target.value)} />
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} /> {tx("ब्याज सहित", "Byaj sahit")}
      </label>
      <Button type="submit">{t("search")}</Button>
    </form>
  );
}
