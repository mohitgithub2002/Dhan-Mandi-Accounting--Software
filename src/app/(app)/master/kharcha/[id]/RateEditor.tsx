"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addChargeRate, endChargeRate } from "@/actions/masters";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Badge, Button, Field, Input, NumInput, Notice, Select, Table, tdCls, thCls } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";

type Rate = { id: number; rate: string; from: string; to: string | null; jins: string | null; party: string | null; by: string | null };

export function RateEditor({
  headId,
  pct,
  rates,
  jins,
  canEdit,
  allowOverride,
  today,
}: {
  headId: number;
  pct: boolean;
  rates: Rate[];
  jins: { id: number; name: string }[];
  canEdit: boolean;
  allowOverride: boolean;
  today: string;
}) {
  const { tx } = useI18n();
  const router = useRouter();
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(today);
  const [commodityId, setC] = useState<number | null>(null);
  const [party, setParty] = useState<PartyHit | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { kind: "ok", text: "✓" } : { kind: "error", text: r.error ?? "" });
      if (r.ok) {
        setRate("");
        router.refresh();
      }
    });
  const live = (r: Rate) => r.from <= today && (!r.to || r.to >= today);
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <thead>
          <tr>
            <th className={thCls}>{tx("दर", "Rate")}</th>
            <th className={thCls}>{tx("जिंस", "Jins")}</th>
            <th className={thCls}>{tx("पार्टी ओवरराइड", "Party override")}</th>
            <th className={thCls}>{tx("से", "From")}</th>
            <th className={thCls}>{tx("तक", "To")}</th>
            <th className={thCls}>{tx("किसने", "By")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 ? (
            <tr>
              <td className={tdCls} colSpan={7}>
                {tx("कोई दर नहीं — यह लाइन अभी किसी पर्ची/बिल पर नहीं लगेगी", "No rate — this line does not apply until a rate is entered")}
              </td>
            </tr>
          ) : null}
          {rates.map((r) => (
            <tr key={r.id} className={live(r) ? "" : "text-slate-400"}>
              <td className={tdCls}>
                <b>{Number(r.rate)}</b> {pct ? "%" : "₹"} {live(r) ? <Badge tone="green">{tx("आज लागू", "in force")}</Badge> : null}
              </td>
              <td className={tdCls}>{r.jins ?? tx("सभी", "All")}</td>
              <td className={tdCls}>{r.party ? <Badge tone="blue">{r.party}</Badge> : "—"}</td>
              <td className={tdCls}>{formatDate(r.from)}</td>
              <td className={tdCls}>{r.to ? formatDate(r.to) : "—"}</td>
              <td className={tdCls}>{r.by}</td>
              <td className={tdCls}>
                {canEdit && !r.to ? (
                  <button type="button" className="text-sm text-naam underline" onClick={() => run(() => endChargeRate({ id: r.id, effectiveTo: today }))}>
                    {tx("आज से ख़त्म", "End today")}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3">
          <Field label={`${tx("नई दर", "New rate")} ${pct ? "%" : "₹"}`}>
            <NumInput className="w-28" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label={tx("कब से", "From date")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={tx("जिंस (खाली = सभी)", "Jins (blank = all)")}>
            <Select value={commodityId ?? ""} onChange={(e) => setC(Number(e.target.value) || null)}>
              <option value="">{tx("सभी", "All")}</option>
              {jins.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </Select>
          </Field>
          {allowOverride ? (
            <Field label={tx("पार्टी के लिए (ओवरराइड)", "For a party (override)")} className="min-w-64">
              <PartySearch types={["vyapari", "agency", "kisan"]} value={party} onChange={setParty} />
            </Field>
          ) : null}
          <Button disabled={pending || rate === ""} onClick={() => run(() => addChargeRate({ chargeHeadId: headId, commodityId, accountId: party?.id ?? null, rate, effectiveFrom: from }))}>
            {tx("दर जोड़ें", "Add rate")}
          </Button>
          <p className="w-full text-sm text-slate-500">
            {tx("पुरानी दर उस तारीख़ से एक दिन पहले बंद होगी; पुरानी पर्चियां/बिल नहीं बदलते।", "The old rate ends the day before; past parchis and bills are untouched.")}
          </p>
        </div>
      ) : null}
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
    </div>
  );
}
