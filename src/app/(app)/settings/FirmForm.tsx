"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveFirm } from "@/actions/settings";
import { Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { ROUND_LABEL } from "@/lib/chargeLabels";
import { useI18n } from "@/lib/i18n/client";

type Firm = {
  nameHi: string; nameEn: string; licenceNo: string; addressHi: string; addressEn: string; phone: string; pan: string; gstin: string; logo: string | null;
  footerText: string; defaultLang: string; parchiMode: string; billMode: string; parchiLayout: string; totalRounding: string; bhavWarnPct: string;
  cashLimit: string; byajDaysInMonth: number; sarkariCreditKisan: boolean;
};

export function FirmForm({ firm }: { firm: Firm }) {
  const { tx, lang } = useI18n();
  const router = useRouter();
  const [f, setF] = useState<Firm>(firm);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Firm>(k: K, v: Firm[K]) => setF({ ...f, [k]: v });
  const text = (k: keyof Firm, label: string) => (
    <Field label={label}>
      <Input value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />
    </Field>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {text("nameHi", tx("फर्म का नाम (हिंदी)", "Firm name (Hindi)"))}
        {text("nameEn", tx("फर्म का नाम (English)", "Firm name (English)"))}
        {text("licenceNo", tx("मंडी लाइसेंस नं.", "Mandi licence no."))}
        {text("addressHi", tx("पता (हिंदी)", "Address (Hindi)"))}
        {text("addressEn", tx("पता (English)", "Address (English)"))}
        {text("phone", tx("फ़ोन", "Phone"))}
        {text("pan", "PAN")}
        {text("gstin", "GSTIN")}
        {text("footerText", tx("प्रिंट के नीचे लाइन", "Print footer text"))}
        <Field label={tx("लोगो (PNG/JPG, 200KB तक)", "Logo (PNG/JPG, up to 200 KB)")}>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => set("logo", String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          {f.logo ? (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.logo} alt="" className="h-12 w-12 object-contain" />
              <button type="button" className="text-sm underline" onClick={() => set("logo", null)}>
                {tx("हटाएं", "Remove")}
              </button>
            </span>
          ) : null}
        </Field>
      </div>
      <h3 className="font-semibold text-slate-700">{tx("काम करने के नियम", "Working rules")}</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={tx("किसान पर्ची", "Kisan parchi")}>
          <Select value={f.parchiMode} onChange={(e) => set("parchiMode", e.target.value)}>
            <option value="per_day">{tx("किसान की एक दिन में एक पर्ची", "One per kisan per day")}</option>
            <option value="per_dheri">{tx("हर ढेरी की अलग पर्ची", "One per dheri")}</option>
          </Select>
        </Field>
        <Field label={tx("व्यापारी बिल", "Vyapari bill")}>
          <Select value={f.billMode} onChange={(e) => set("billMode", e.target.value)}>
            <option value="per_day">{tx("व्यापारी का एक दिन में एक बिल", "One per vyapari per day")}</option>
            <option value="per_dheri">{tx("हर ढेरी का अलग बिल", "One per dheri")}</option>
          </Select>
        </Field>
        <Field label={tx("कुल की राउंडिंग", "Total rounding")}>
          <Select value={f.totalRounding} onChange={(e) => set("totalRounding", e.target.value)}>
            {Object.entries(ROUND_LABEL).map(([k, v]) => <option key={k} value={k}>{v[lang === "en" ? 1 : 0]}</option>)}
          </Select>
        </Field>
        <Field label={tx("प्रिंट भाषा", "Print language")}>
          <Select value={f.defaultLang} onChange={(e) => set("defaultLang", e.target.value)}>
            <option value="both">{tx("दोनों", "Both")}</option>
            <option value="hi">हिंदी</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={tx("पर्ची का साइज़", "Parchi layout")}>
          <Select value={f.parchiLayout} onChange={(e) => set("parchiLayout", e.target.value)}>
            <option value="full">{tx("पूरा A4", "Full A4")}</option>
            <option value="half">{tx("आधा A4 (एक पेज पर दो)", "Half A4 (two per page)")}</option>
          </Select>
        </Field>
        <Field label={tx("भाव चेतावनी ± %", "Bhav warning ± %")}>
          <NumInput value={f.bhavWarnPct} onChange={(e) => set("bhavWarnPct", e.target.value)} />
        </Field>
        <Field label={tx("नकद सीमा ₹ (चेतावनी)", "Cash limit ₹ (warning)")} hint={tx("CA से तय करें", "Decide with your CA")}>
          <NumInput value={f.cashLimit} onChange={(e) => set("cashLimit", e.target.value)} />
        </Field>
        <Field label={tx("ब्याज: महीने के दिन", "Byaj: days in a month")}>
          <NumInput value={String(f.byajDaysInMonth)} onChange={(e) => set("byajDaysInMonth", Number(e.target.value) || 30)} />
        </Field>
        <label className="flex items-center gap-2 self-end">
          <input type="checkbox" checked={f.sarkariCreditKisan} onChange={(e) => set("sarkariCreditKisan", e.target.checked)} />
          {tx("सरकारी खरीद की रकम किसान खाते में जमा करें", "Credit sarkari crop value to kisan khata")}
        </label>
      </div>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveFirm(f);
              setMsg(r.ok ? { kind: "ok", text: "✓" } : { kind: "error", text: r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          {tx("सेव", "Save")}
        </Button>
      </div>
    </div>
  );
}
