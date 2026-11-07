"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBoliAction } from "@/actions/entry";
import { KeyForm } from "@/components/KeyForm";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, NumInput, Notice } from "@/components/ui";
import { formatINR } from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";
import type { DayLot } from "@/lib/server/queries";

type Band = { avg: string; low: string; high: string };
interface Part {
  id?: number;
  vyapari: PartyHit | null;
  bhav: string;
  bags: string;
}

function toParts(l: DayLot): Part[] {
  const sold = l.sales.filter((s) => s.vyapariId);
  if (!sold.length) return [{ vyapari: null, bhav: "", bags: String(l.bags || "") }];
  return sold.map((s) => ({
    id: s.id,
    vyapari: { id: s.vyapariId!, nameHi: s.vyapariHi ?? "", nameEn: s.vyapariEn ?? "", fatherName: "", village: s.village ?? "", mobile: "", partyType: s.vyapariType ?? "vyapari" },
    bhav: s.bhav ?? "",
    bags: String(s.bags),
  }));
}

export function BoliSheet({ lots, bands }: { lots: DayLot[]; bands: Record<number, Band> }) {
  const { t, tx } = useI18n();
  if (!lots.length) return <Notice kind="ok">{tx("सब ढेरियों की बोली हो चुकी है।", "Boli is done for all lots.")}</Notice>;
  return (
    <div className="flex flex-col gap-2">
      <div className="hidden grid-cols-[260px_1fr] gap-3 px-3 text-sm font-semibold text-slate-600 md:grid">
        <span>
          {t("dheri")} · {t("kisan")} · {t("jins")}
        </span>
        <span>
          {t("vyapari")} · {t("bhav")} · {tx("बोरी", "Bags")}
        </span>
      </div>
      {lots.map((l, i) => (
        <BoliRow key={l.lotId} lot={l} index={i} band={bands[l.commodityId]} />
      ))}
    </div>
  );
}

function BoliRow({ lot, index, band }: { lot: DayLot; index: number; band?: Band }) {
  const { tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [parts, setParts] = useState<Part[]>(() => toParts(lot));
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const set = (i: number, p: Partial<Part>) => setParts(parts.map((x, j) => (j === i ? { ...x, ...p } : x)));

  function save() {
    const bad = parts.find((p) => !p.vyapari || !Number(p.bhav));
    if (bad) return setMsg({ kind: "error", text: !bad.vyapari ? tx("व्यापारी चुनें", "Choose vyapari") : tx("भाव डालें", "Enter bhav") });
    start(async () => {
      const r = await saveBoliAction({
        lotId: lot.lotId,
        parts: parts.map((p) => ({ id: p.id, vyapariId: p.vyapari!.id, bhav: p.bhav, bags: Number(p.bags) || 0 })),
      });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: "ok", text: "✓" });
      router.refresh();
      document.querySelector<HTMLInputElement>(`[data-boli-row="${index + 1}"] [data-party-search]`)?.focus();
    });
  }

  const name = lang === "en" ? lot.kisanEn || lot.kisanHi : lot.kisanHi || lot.kisanEn;
  return (
    <div data-boli-row={index} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <KeyForm
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="grid gap-3 md:grid-cols-[260px_1fr]"
      >
        <div>
          <div className="font-semibold">
            #{lot.lotId} · {name}
          </div>
          <div className="text-sm text-slate-600">
            {lang === "en" ? lot.jinsEn : lot.jinsHi} · {lot.bags} {tx("बोरी", "bags")} · {lot.village}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={lot.status} />
            {band ? (
              <span className="text-sm text-slate-500">
                {tx("औसत", "avg")} ₹{formatINR(band.avg)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {parts.map((p, i) => {
            const out = band && Number(p.bhav) && (Number(p.bhav) < Number(band.low) || Number(p.bhav) > Number(band.high));
            return (
              <div key={i} className="grid items-start gap-2 md:grid-cols-[1fr_140px_100px_auto]">
                <PartySearch types={["vyapari", "agency"]} value={p.vyapari} onChange={(v) => set(i, { vyapari: v })} />
                <div>
                  <NumInput aria-label={tx("भाव", "Bhav")} placeholder={tx("भाव", "Bhav")} value={p.bhav} onChange={(e) => set(i, { bhav: e.target.value })} />
                  {out ? <div className="text-sm text-amber-800">⚠ {tx("भाव सामान्य से अलग", "Bhav out of range")}</div> : null}
                </div>
                <NumInput aria-label={tx("बोरी", "Bags")} placeholder={tx("बोरी", "Bags")} value={p.bags} onChange={(e) => set(i, { bags: e.target.value })} />
                {parts.length > 1 ? (
                  <Button variant="ghost" data-skip onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                    ✕
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              data-skip
              onClick={() => {
                const used = parts.reduce((a, p) => a + (Number(p.bags) || 0), 0);
                setParts([...parts, { vyapari: null, bhav: parts[0]?.bhav ?? "", bags: String(Math.max(lot.bags - used, 0) || "") }]);
              }}
            >
              + {tx("दूसरे व्यापारी को (बांटें)", "Split to another vyapari")}
            </Button>
            <Button type="submit" disabled={pending}>
              {tx("सेव", "Save")}
            </Button>
            {msg ? <span className={msg.kind === "ok" ? "text-jama" : "text-naam"}>{msg.text}</span> : null}
          </div>
        </div>
      </KeyForm>
    </div>
  );
}
