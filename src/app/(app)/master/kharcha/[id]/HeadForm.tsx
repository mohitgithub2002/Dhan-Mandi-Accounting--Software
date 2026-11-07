"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveChargeHead, setHeadActive } from "@/actions/masters";
import { Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { BASIS_LABEL, KIND_LABEL, PAYER_LABEL, POST_LABEL, ROUND_LABEL } from "@/lib/chargeLabels";
import { useI18n } from "@/lib/i18n/client";

export interface HeadData {
  id?: number;
  code: string;
  nameHi: string;
  nameEn: string;
  kind: string;
  basis: string;
  refHeadId: number | null;
  payer: string;
  splitKisanPct: string;
  saleType: string;
  allowPartyOverride: boolean;
  postMode: string;
  postAccountId: number | null;
  seq: number;
  rounding: string;
  onParchi: boolean;
  onBill: boolean;
  printLabelHi: string;
  printLabelEn: string;
  activeFrom: string;
  activeTo: string | null;
}

export function HeadForm({
  data,
  others,
  postAccounts,
  canEdit,
  today,
}: {
  data: HeadData;
  others: { id: number; nameHi: string; nameEn: string }[];
  postAccounts: { id: number; nameHi: string; nameEn: string }[];
  canEdit: boolean;
  today: string;
}) {
  const { tx, lang } = useI18n();
  const router = useRouter();
  const [f, setF] = useState(data);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [offDate, setOffDate] = useState(today);
  const [pending, start] = useTransition();
  const set = <K extends keyof HeadData>(k: K, v: HeadData[K]) => setF({ ...f, [k]: v });
  const opts = (m: Record<string, [string, string]>) => Object.entries(m).map(([k, v]) => <option key={k} value={k}>{v[lang === "en" ? 1 : 0]}</option>);
  const active = f.activeFrom <= today && (!f.activeTo || f.activeTo > today);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (d: unknown) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setMsg({ kind: "error", text: r.error ?? "" });
      setMsg({ kind: "ok", text: "✓" });
      after?.(r.data);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label={tx("कोड", "Code")}>
          <Input value={f.code} disabled={!canEdit || !!f.id} onChange={(e) => set("code", e.target.value.toUpperCase())} />
        </Field>
        <Field label={tx("नाम हिंदी", "Name (Hindi)")}>
          <Input value={f.nameHi} disabled={!canEdit} onChange={(e) => set("nameHi", e.target.value)} />
        </Field>
        <Field label={tx("नाम English", "Name (English)")}>
          <Input value={f.nameEn} disabled={!canEdit} onChange={(e) => set("nameEn", e.target.value)} />
        </Field>
        <Field label={tx("प्रकार", "Kind")}>
          <Select value={f.kind} disabled={!canEdit} onChange={(e) => set("kind", e.target.value)}>{opts(KIND_LABEL)}</Select>
        </Field>
        <Field label={tx("आधार", "Basis")}>
          <Select value={f.basis} disabled={!canEdit} onChange={(e) => set("basis", e.target.value)}>{opts(BASIS_LABEL)}</Select>
        </Field>
        {f.basis === "pct_of_line" ? (
          <Field label={tx("किस खर्चे का %", "% of which line")}>
            <Select value={f.refHeadId ?? ""} disabled={!canEdit} onChange={(e) => set("refHeadId", Number(e.target.value) || null)}>
              <option value="">—</option>
              {others.map((o) => <option key={o.id} value={o.id}>{lang === "en" ? o.nameEn : o.nameHi}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label={tx("कौन देगा", "Paid by")}>
          <Select value={f.payer} disabled={!canEdit} onChange={(e) => set("payer", e.target.value)}>{opts(PAYER_LABEL)}</Select>
        </Field>
        {f.payer === "split" ? (
          <Field label={tx("किसान का हिस्सा %", "Kisan share %")}>
            <NumInput value={f.splitKisanPct} disabled={!canEdit} onChange={(e) => set("splitKisanPct", e.target.value)} />
          </Field>
        ) : null}
        <Field label={tx("बिक्री प्रकार", "Sale type")}>
          <Select value={f.saleType} disabled={!canEdit} onChange={(e) => set("saleType", e.target.value)}>
            <option value="private">{tx("निजी", "Private")}</option>
            <option value="sarkari">{tx("सरकारी खरीद", "Sarkari")}</option>
            <option value="both">{tx("दोनों", "Both")}</option>
          </Select>
        </Field>
        <Field label={tx("कहां जाएगा", "Posts to")}>
          <Select value={f.postMode} disabled={!canEdit} onChange={(e) => set("postMode", e.target.value)}>{opts(POST_LABEL)}</Select>
        </Field>
        {f.postMode !== "show" ? (
          <Field label={tx("खाता", "Account")}>
            <Select value={f.postAccountId ?? ""} disabled={!canEdit} onChange={(e) => set("postAccountId", Number(e.target.value) || null)}>
              <option value="">—</option>
              {postAccounts.map((a) => <option key={a.id} value={a.id}>{lang === "en" ? a.nameEn || a.nameHi : a.nameHi || a.nameEn}</option>)}
            </Select>
          </Field>
        ) : null}
        <Field label={tx("क्रम", "Order (kram)")}>
          <NumInput value={String(f.seq)} disabled={!canEdit} onChange={(e) => set("seq", Number(e.target.value) || 0)} />
        </Field>
        <Field label={tx("राउंडिंग", "Rounding")}>
          <Select value={f.rounding} disabled={!canEdit} onChange={(e) => set("rounding", e.target.value)}>{opts(ROUND_LABEL)}</Select>
        </Field>
        <Field label={tx("प्रिंट नाम हिंदी", "Print label Hindi")}>
          <Input value={f.printLabelHi} disabled={!canEdit} onChange={(e) => set("printLabelHi", e.target.value)} />
        </Field>
        <Field label={tx("प्रिंट नाम English", "Print label English")}>
          <Input value={f.printLabelEn} disabled={!canEdit} onChange={(e) => set("printLabelEn", e.target.value)} />
        </Field>
        <Field label={tx("कब से लागू", "Active from")}>
          <Input type="date" value={f.activeFrom} disabled={!canEdit} onChange={(e) => set("activeFrom", e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        {(
          [
            ["onParchi", tx("पर्ची पर छपे", "Show on parchi")],
            ["onBill", tx("बिल पर छपे", "Show on bill")],
            ["allowPartyOverride", tx("पार्टी ओवरराइड चले", "Party override allowed")],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" disabled={!canEdit} checked={f[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
          </label>
        ))}
      </div>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => saveChargeHead({ ...f, activeTo: undefined }),
                (d) => {
                  if (!f.id) router.push(`/master/kharcha/${(d as { id: number }).id}`);
                },
              )
            }
          >
            {tx("सेव", "Save")}
          </Button>
          {f.id ? (
            <>
              <Field label={tx("तारीख़", "Date")}>
                <Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} />
              </Field>
              {active ? (
                <Button variant="danger" disabled={pending} onClick={() => run(() => setHeadActive({ id: f.id!, active: false, date: offDate }))}>
                  {tx("इस तारीख़ से बंद करें", "Make inactive from this date")}
                </Button>
              ) : (
                <Button variant="success" disabled={pending} onClick={() => run(() => setHeadActive({ id: f.id!, active: true, date: offDate }))}>
                  {tx("फिर चालू करें", "Activate")}
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(tx("पूरी तरह मिटाएं? (केवल अगर कभी इस्तेमाल नहीं हुआ)", "Delete permanently? (only if never used)")))
                    run(() => setHeadActive({ id: f.id!, active: false, date: offDate, hardDelete: true }), () => router.push("/master/kharcha"));
                }}
              >
                {tx("मिटाएं", "Delete")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
