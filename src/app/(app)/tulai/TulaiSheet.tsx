"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTulaiAction } from "@/actions/entry";
import { BagWeights } from "@/components/BagWeights";
import { KeyForm } from "@/components/KeyForm";
import { Button, Field, NumInput, Notice } from "@/components/ui";
import { computeNetWeight, formatINR, formatQtlKg, rakam } from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";

export interface TulaiRowData {
  saleId: number;
  lotId: number;
  kisan: string;
  jins: string;
  vyapari: string;
  bhav: string;
  bags: string;
  weighMode: "total" | "bagwise";
  grossKg: string;
  bagKgs: string[];
  tarePerBagKg: string;
  moisturePct: string;
  dustKg: string;
  netKg: string;
}

export function TulaiSheet({ rows }: { rows: TulaiRowData[] }) {
  const { tx } = useI18n();
  if (!rows.length) return <Notice kind="ok">{tx("कोई तुलाई बाकी नहीं।", "No tulai pending.")}</Notice>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <TulaiRow key={r.saleId} row={r} index={i} />
      ))}
    </div>
  );
}

function TulaiRow({ row, index }: { row: TulaiRowData; index: number }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(row.weighMode);
  const [bags, setBags] = useState(row.bags);
  const [gross, setGross] = useState(row.grossKg);
  const [bagKgs, setBagKgs] = useState<string[]>(row.bagKgs);
  const [tare, setTare] = useState(row.tarePerBagKg);
  const [nami, setNami] = useState(row.moisturePct);
  const [dust, setDust] = useState(row.dustKg);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const bagCount = mode === "bagwise" ? bagKgs.filter((v) => Number(v) > 0).length : Number(bags) || 0;
  const g = mode === "bagwise" ? bagKgs.reduce((a, v) => a + (Number(v) || 0), 0) : Number(gross) || 0;
  const w = computeNetWeight({ grossKg: g, bags: bagCount, tarePerBagKg: tare || 0, moisturePct: nami || 0, dustKg: dust || 0 });
  const amt = rakam(w.netKg, row.bhav);

  function save() {
    start(async () => {
      const r = await saveTulaiAction({ saleId: row.saleId, weighMode: mode, bags: bagCount, grossKg: String(g), bagKgs, tarePerBagKg: tare, moisturePct: nami, dustKg: dust });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: "ok", text: "✓" });
      router.refresh();
      document.querySelector<HTMLInputElement>(`[data-tulai-row="${index + 1}"] input:not([type=radio])`)?.focus();
    });
  }

  return (
    <div data-tulai-row={index} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <KeyForm
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid gap-3 lg:grid-cols-[230px_1fr_220px]"
      >
        <div>
          <div className="font-semibold">
            #{row.lotId} · {row.kisan}
          </div>
          <div className="text-sm text-slate-600">
            {row.jins} → {row.vyapari}
          </div>
          <div className="text-sm text-slate-600">
            {t("bhav")} ₹{formatINR(row.bhav)}
          </div>
          <div className="mt-1 flex gap-3 text-sm">
            {(["total", "bagwise"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="radio" data-skip checked={mode === m} onChange={() => setMode(m)} />
                {m === "total" ? tx("कुल", "Total") : tx("बोरी अनुसार", "Bag-wise")}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {mode === "total" ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Field label={tx("बोरी", "Bags")}>
                <NumInput value={bags} onChange={(e) => setBags(e.target.value)} />
              </Field>
              <Field label={`${tx("कुल वज़न", "Gross")} kg`}>
                <NumInput value={gross} onChange={(e) => setGross(e.target.value)} />
              </Field>
              <Field label={`${tx("बोरी वज़न", "Tare")} kg`}>
                <NumInput value={tare} onChange={(e) => setTare(e.target.value)} />
              </Field>
              <Field label={`${t("nami")} %`}>
                <NumInput value={nami} onChange={(e) => setNami(e.target.value)} />
              </Field>
              <Field label={`${tx("मिट्टी", "Dust")} kg`}>
                <NumInput value={dust} onChange={(e) => setDust(e.target.value)} />
              </Field>
            </div>
          ) : (
            <>
              <BagWeights value={bagKgs} onChange={setBagKgs} />
              <div className="grid grid-cols-3 gap-2">
                <Field label={`${tx("बोरी वज़न", "Tare")} kg`}>
                  <NumInput value={tare} onChange={(e) => setTare(e.target.value)} />
                </Field>
                <Field label={`${t("nami")} %`}>
                  <NumInput value={nami} onChange={(e) => setNami(e.target.value)} />
                </Field>
                <Field label={`${tx("मिट्टी", "Dust")} kg`}>
                  <NumInput value={dust} onChange={(e) => setDust(e.target.value)} />
                </Field>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col justify-between gap-2 rounded-md bg-brand-50 p-2">
          <div>
            <div className="flex justify-between">
              <span>{t("netWeight")}</span>
              <b className="num">{formatQtlKg(w.netKg.toString(), lang)}</b>
            </div>
            <div className="flex justify-between">
              <span>{t("rakam")}</span>
              <b className="num">{formatINR(amt)}</b>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
            {msg ? <span className={msg.kind === "ok" ? "text-jama" : "text-naam"}>{msg.text}</span> : null}
          </div>
        </div>
      </KeyForm>
    </div>
  );
}
