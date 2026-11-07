"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDheri } from "@/actions/entry";
import { BagWeights } from "@/components/BagWeights";
import { KeyForm } from "@/components/KeyForm";
import { BhavWarning, LivePanel, useLiveCalc, useRateContext } from "@/components/LivePanel";
import { PartySearch, partyLabel, type PartyHit } from "@/components/PartySearch";
import { Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { formatINR } from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";
import type { Commodity } from "@/lib/server/queries";

interface LastSaved {
  text: string;
  parchiIds: number[];
}

export function DheriForm({ date, jins }: { date: string; jins: Commodity[] }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kisan, setKisan] = useState<PartyHit | null>(null);
  const [vyapari, setVyapari] = useState<PartyHit | null>(null);
  const [commodityId, setCommodityId] = useState<number | null>(jins[0]?.id ?? null);
  const c = jins.find((j) => j.id === commodityId);
  const [bags, setBags] = useState("");
  const [bhav, setBhav] = useState("");
  const [weighMode, setWeighMode] = useState<"total" | "bagwise">((c?.weighMode as "total") ?? "total");
  const [grossKg, setGrossKg] = useState("");
  const [bagKgs, setBagKgs] = useState<string[]>([]);
  const [tare, setTare] = useState(c?.defaultTareKg ?? "0");
  const [nami, setNami] = useState(c?.defaultMoisturePct ?? "0");
  const [dust, setDust] = useState("0");
  const [gate, setGate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [last, setLast] = useState<LastSaved | null>(null);

  const saleType = vyapari?.partyType === "agency" ? "sarkari" : "private";
  const ctx = useRateContext(date, saleType, kisan?.id ?? null, vyapari?.id ?? null, commodityId);
  const gross = weighMode === "bagwise" ? String(bagKgs.reduce((a, v) => a + (Number(v) || 0), 0)) : grossKg;
  const bagCount = weighMode === "bagwise" ? bagKgs.filter((v) => Number(v) > 0).length : Number(bags) || 0;
  const calc = useLiveCalc(ctx, { commodityId, bags: bagCount, bhav, grossKg: gross, tarePerBagKg: tare, moisturePct: nami, dustKg: dust });
  const dirty = !!(kisan || bhav || grossKg || bagKgs.length);

  function onJins(id: number) {
    setCommodityId(id);
    const j = jins.find((x) => x.id === id);
    if (j) {
      setWeighMode(j.weighMode as "total");
      setTare(j.defaultTareKg);
      setNami(j.defaultMoisturePct);
    }
  }

  function reset() {
    setKisan(null);
    setVyapari(null);
    setBags("");
    setBhav("");
    setGrossKg("");
    setBagKgs([]);
    setDust("0");
    setGate("");
    setVehicle("");
    setTimeout(() => document.querySelector<HTMLInputElement>("[data-party-search]")?.focus(), 0);
  }

  function submit(print: boolean) {
    setError("");
    if (!kisan) return setError(tx("किसान चुनें", "Choose the kisan"));
    if (!commodityId) return setError(tx("जिंस चुनें", "Choose the jins"));
    if (print && (!vyapari || !Number(bhav) || !Number(gross))) {
      return setError(tx("पर्ची के लिए व्यापारी, भाव और वज़न डालें", "Enter vyapari, bhav and weight for the parchi"));
    }
    if (vyapari && !Number(bhav)) return setError(tx("भाव डालें", "Enter bhav"));
    const printWin = print ? window.open("about:blank", "_blank") : null;
    start(async () => {
      const r = await saveDheri({
        date,
        kisanId: kisan.id,
        gateEntryNo: gate,
        vehicleNo: vehicle,
        commodityId,
        bags: bagCount,
        vyapariId: vyapari?.id ?? null,
        bhav: bhav || undefined,
        tulai: Number(gross) > 0 ? { weighMode, grossKg: grossKg || "0", bagKgs, tarePerBagKg: tare, moisturePct: nami, dustKg: dust } : null,
        print,
      });
      if (!r.ok) {
        printWin?.close();
        setError(r.error);
        return;
      }
      setWarnings(r.warnings ?? []);
      const d = r.data;
      if (printWin) {
        if (d.parchiIds.length) printWin.location.href = `/print/parchi/${d.parchiIds[0]}?auto=1`;
        else printWin.close();
      }
      setLast({
        text: `${tx("आमद", "Aamad")} #${d.arrivalNo} · ${partyLabel(kisan, lang)} · ${calc ? `${t("rakam")} ₹${formatINR(calc.sale.grossAmount)}` : ""}`,
        parchiIds: d.parchiIds,
      });
      reset();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <KeyForm
        dirty={dirty}
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        onPrint={() => submit(true)}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={`${t("kisan")} (F2)`}>
            <PartySearch types={["kisan"]} value={kisan} onChange={setKisan} autoFocus quickAdd="kisan" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("jins")} (F3)`}>
              <Select data-jins value={commodityId ?? ""} onChange={(e) => onJins(Number(e.target.value))}>
                {jins.map((j) => (
                  <option key={j.id} value={j.id}>
                    {lang === "en" ? j.nameEn : `${j.nameHi} / ${j.nameEn}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("katta")}>
              <NumInput value={weighMode === "bagwise" ? String(bagCount) : bags} disabled={weighMode === "bagwise"} onChange={(e) => setBags(e.target.value)} />
            </Field>
          </div>
          <Field label={t("vyapari")}>
            <PartySearch types={["vyapari", "agency"]} value={vyapari} onChange={setVyapari} />
          </Field>
          <Field label={`${t("bhav")} (₹ / ${tx("क्विंटल", "qtl")})`} hint={<BhavWarning ctx={ctx} bhav={bhav} />}>
            <NumInput value={bhav} onChange={(e) => setBhav(e.target.value)} />
          </Field>
        </div>

        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 font-semibold text-slate-700">{t("tulai")}</legend>
          <div className="mb-3 flex gap-4">
            {(["total", "bagwise"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input type="radio" data-skip name="weighMode" checked={weighMode === m} onChange={() => setWeighMode(m)} />
                {m === "total" ? tx("कुल वज़न", "Total weight") : tx("बोरी अनुसार", "Bag-wise")}
              </label>
            ))}
          </div>
          {weighMode === "total" ? (
            <Field label={`${t("grossWeight")} (kg)`}>
              <NumInput value={grossKg} onChange={(e) => setGrossKg(e.target.value)} />
            </Field>
          ) : (
            <BagWeights value={bagKgs} onChange={setBagKgs} />
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field label={`${t("tare")} (kg/${tx("बोरी", "bag")})`}>
              <NumInput value={tare} onChange={(e) => setTare(e.target.value)} />
            </Field>
            <Field label={`${t("nami")} %`}>
              <NumInput value={nami} onChange={(e) => setNami(e.target.value)} />
            </Field>
            <Field label={`${t("mitti")} (kg)`}>
              <NumInput value={dust} onChange={(e) => setDust(e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={tx("गेट एंट्री नं.", "Gate entry no.")}>
            <Input value={gate} onChange={(e) => setGate(e.target.value)} />
          </Field>
          <Field label={tx("गाड़ी नं.", "Vehicle no.")}>
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} />
          </Field>
        </div>

        {error ? <Notice kind="error">{error}</Notice> : null}
        {warnings.map((w) => (
          <Notice key={w} kind="warn">
            {w}
          </Notice>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {t("save")} (Ctrl+S)
          </Button>
          <Button variant="success" disabled={pending} onClick={() => submit(true)}>
            {t("savePrint")} (Ctrl+P)
          </Button>
        </div>
      </KeyForm>

      <div className="flex flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        <LivePanel calc={calc} />
        {last ? (
          <Notice kind="ok">
            ✓ {tx("सेव हुआ", "Saved")}: {last.text}
            {last.parchiIds.map((id) => (
              <a key={id} className="ml-2 underline" href={`/print/parchi/${id}`} target="_blank">
                {tx("पर्ची देखें", "View parchi")}
              </a>
            ))}
          </Notice>
        ) : null}
      </div>
    </div>
  );
}
