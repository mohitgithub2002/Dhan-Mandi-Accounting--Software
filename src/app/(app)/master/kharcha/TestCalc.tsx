"use client";
import { useState } from "react";
import { LivePanel, useLiveCalc, useRateContext } from "@/components/LivePanel";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Field, Input, NumInput, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import type { Commodity } from "@/lib/server/queries";

/** Enter a sample dheri and see parchi and bill totals with the master as on a date (PRD §6 "Test"). */
export function TestCalc({ jins, date: d0 }: { jins: Commodity[]; date: string }) {
  const { tx, t, lang } = useI18n();
  const [date, setDate] = useState(d0);
  const [commodityId, setC] = useState<number | null>(jins[0]?.id ?? null);
  const [bags, setBags] = useState("100");
  const [gross, setGross] = useState("5000");
  const [bhav, setBhav] = useState("2450");
  const [saleType, setSaleType] = useState("private");
  const [vyapari, setV] = useState<PartyHit | null>(null);
  const ctx = useRateContext(date, saleType, null, vyapari?.id ?? null, commodityId);
  const calc = useLiveCalc(ctx, { commodityId, bags: Number(bags) || 0, bhav, grossKg: gross, tarePerBagKg: "0", moisturePct: "0", dustKg: "0" });
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={tx("तारीख़ (भविष्य की दर जांचें)", "Date (try a future rate)")}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("jins")}>
          <Select value={commodityId ?? ""} onChange={(e) => setC(Number(e.target.value))}>
            {jins.map((j) => (
              <option key={j.id} value={j.id}>{lang === "en" ? j.nameEn : j.nameHi}</option>
            ))}
          </Select>
        </Field>
        <Field label={tx("बिक्री", "Sale type")}>
          <Select value={saleType} onChange={(e) => setSaleType(e.target.value)}>
            <option value="private">{tx("निजी", "Private")}</option>
            <option value="sarkari">{tx("सरकारी", "Sarkari")}</option>
          </Select>
        </Field>
        <Field label={tx("बोरी", "Bags")}>
          <NumInput value={bags} onChange={(e) => setBags(e.target.value)} />
        </Field>
        <Field label={tx("शुद्ध वज़न kg", "Net weight kg")}>
          <NumInput value={gross} onChange={(e) => setGross(e.target.value)} />
        </Field>
        <Field label={t("bhav")}>
          <NumInput value={bhav} onChange={(e) => setBhav(e.target.value)} />
        </Field>
        <Field label={tx("व्यापारी (ओवरराइड जांचें, वैकल्पिक)", "Vyapari (check override, optional)")} className="md:col-span-3">
          <PartySearch types={["vyapari", "agency"]} value={vyapari} onChange={setV} />
        </Field>
      </div>
      <LivePanel calc={calc} />
    </div>
  );
}
