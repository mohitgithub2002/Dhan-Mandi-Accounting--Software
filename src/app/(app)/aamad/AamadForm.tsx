"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveArrival } from "@/actions/entry";
import { KeyForm } from "@/components/KeyForm";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import type { Commodity } from "@/lib/server/queries";

export function AamadForm({ date, jins }: { date: string; jins: Commodity[] }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kisan, setKisan] = useState<PartyHit | null>(null);
  const [gate, setGate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState([{ commodityId: jins[0]?.id ?? 0, bags: "", qualityNote: "" }]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function save() {
    if (!kisan) return setMsg({ kind: "error", text: tx("किसान चुनें", "Choose the kisan") });
    start(async () => {
      const r = await saveArrival({
        date,
        kisanId: kisan.id,
        gateEntryNo: gate,
        vehicleNo: vehicle,
        remarks,
        lots: rows.map((x) => ({ ...x, bags: Number(x.bags) || 0 })),
      });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: "ok", text: `✓ ${tx("आमद", "Aamad")} #${r.data.arrivalNo} · ${r.data.lotIds.length} ${tx("ढेरी", "lot(s)")}` });
      setKisan(null);
      setGate("");
      setVehicle("");
      setRemarks("");
      setRows([{ commodityId: jins[0]?.id ?? 0, bags: "", qualityNote: "" }]);
      router.refresh();
      document.querySelector<HTMLInputElement>("[data-party-search]")?.focus();
    });
  }

  return (
    <KeyForm
      dirty={!!kisan}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Field label={`${t("kisan")} (F2)`} className="md:col-span-2">
          <PartySearch types={["kisan"]} value={kisan} onChange={setKisan} autoFocus quickAdd="kisan" />
        </Field>
        <Field label={tx("गेट एंट्री नं.", "Gate entry no.")}>
          <Input value={gate} onChange={(e) => setGate(e.target.value)} />
        </Field>
        <Field label={tx("गाड़ी नं.", "Vehicle no.")}>
          <Input value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} />
        </Field>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
          <Field label={`${t("dheri")} ${i + 1} — ${t("jins")}`}>
            <Select data-jins={i === 0 ? true : undefined} value={r.commodityId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, commodityId: Number(e.target.value) } : x)))}>
              {jins.map((j) => (
                <option key={j.id} value={j.id}>
                  {lang === "en" ? j.nameEn : `${j.nameHi} / ${j.nameEn}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tx("अनुमानित बोरी", "Estimated bags")}>
            <NumInput value={r.bags} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, bags: e.target.value } : x)))} />
          </Field>
          <Field label={tx("क्वालिटी / टिप्पणी", "Quality note")}>
            <Input value={r.qualityNote} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qualityNote: e.target.value } : x)))} />
          </Field>
          {rows.length > 1 ? (
            <Button variant="ghost" data-skip onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              ✕
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <Field label={t("remarks")}>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="secondary" data-skip onClick={() => setRows([...rows, { commodityId: jins[0]?.id ?? 0, bags: "", qualityNote: "" }])}>
          + {tx("और ढेरी (अलग जिंस / क्वालिटी)", "Another lot (other jins / quality)")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t("save")} (Ctrl+S)
        </Button>
      </div>
    </KeyForm>
  );
}
