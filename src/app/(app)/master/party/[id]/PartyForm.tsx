"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { findDuplicates, saveParty } from "@/actions/masters";
import { KeyForm } from "@/components/KeyForm";
import { Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import { EDITABLE_PARTY_TYPES, PARTY_TYPE_LABEL } from "@/lib/partyTypes";

export interface PartyData {
  id?: number;
  partyType: string;
  nameHi: string;
  nameEn: string;
  fatherName: string;
  village: string;
  tehsil: string;
  mobile: string;
  pan: string;
  aadhaarLast4: string;
  bankName: string;
  bankAc: string;
  ifsc: string;
  gstin: string;
  licenceNo: string;
  openingAmount: string;
  openingSide: "jama" | "naam";
  creditDays: number;
  active: boolean;
  isSystem: boolean;
}

export function PartyForm({ data, canEdit }: { data: PartyData; canEdit: boolean }) {
  const { tx, lang } = useI18n();
  const router = useRouter();
  const [f, setF] = useState(data);
  const [dups, setDups] = useState<{ id: number; nameHi: string; nameEn: string; village: string }[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof PartyData>(k: K, v: PartyData[K]) => setF({ ...f, [k]: v });
  const isTrader = f.partyType === "vyapari" || f.partyType === "agency";

  const checkDup = async () => {
    const name = f.nameHi || f.nameEn;
    if (!name) return;
    setDups(await findDuplicates({ name, village: f.village, excludeId: f.id }));
  };

  function save() {
    start(async () => {
      const r = await saveParty({ ...f, isSystem: undefined });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: "ok", text: `✓ ${tx("सेव हुआ", "Saved")} #${r.data.id}` });
      if (!f.id) router.push(`/master/party/${r.data.id}`);
      else router.refresh();
    });
  }

  const text = (k: keyof PartyData, label: string, extra?: Partial<React.ComponentProps<"input">>) => (
    <Field label={label}>
      <Input value={String(f[k] ?? "")} disabled={!canEdit} onChange={(e) => set(k, e.target.value as never)} {...extra} />
    </Field>
  );

  return (
    <KeyForm
      dirty={false}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={tx("प्रकार", "Type")}>
          <Select value={f.partyType} disabled={!canEdit || f.isSystem} onChange={(e) => set("partyType", e.target.value)}>
            {EDITABLE_PARTY_TYPES.map((k) => (
              <option key={k} value={k}>{PARTY_TYPE_LABEL[k][lang === "en" ? 1 : 0]}</option>
            ))}
          </Select>
        </Field>
        {text("nameHi", tx("नाम (हिंदी)", "Name (Hindi)"), { onBlur: checkDup, autoFocus: !f.id })}
        {text("nameEn", tx("नाम (English)", "Name (English)"), { onBlur: checkDup })}
        {text("fatherName", tx("पिता का नाम", "Father's name"))}
        {text("village", tx("गांव", "Village"), { onBlur: checkDup })}
        {text("tehsil", tx("तहसील", "Tehsil"))}
        {text("mobile", tx("मोबाइल", "Mobile"), { inputMode: "numeric" })}
        {text("pan", "PAN")}
        {text("aadhaarLast4", tx("आधार (आख़िरी 4 अंक)", "Aadhaar (last 4 only)"), { maxLength: 4, inputMode: "numeric" })}
      </div>
      {dups.length ? (
        <Notice kind="warn">
          {tx("इसी नाम और गांव का खाता पहले से है", "An account with the same name and village exists")}:{" "}
          {dups.map((d) => (
            <a key={d.id} className="mr-2 underline" href={`/master/party/${d.id}`} target="_blank">
              #{d.id} {d.nameHi || d.nameEn} ({d.village})
            </a>
          ))}
        </Notice>
      ) : null}
      {isTrader ? (
        <div className="grid gap-3 md:grid-cols-3">
          {text("licenceNo", tx("मंडी लाइसेंस नं.", "Mandi licence no."))}
          {text("gstin", "GSTIN")}
          <Field label={tx("उधार दिन", "Credit days")}>
            <NumInput value={String(f.creditDays)} disabled={!canEdit} onChange={(e) => set("creditDays", Number(e.target.value) || 0)} />
          </Field>
        </div>
      ) : null}
      <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-600">{tx("बैंक (केवल मालिक/मुनीम देखें)", "Bank (malik / munim only)")}</legend>
        {text("bankName", tx("बैंक का नाम", "Bank name"))}
        {text("bankAc", tx("खाता नं.", "Account no."))}
        {text("ifsc", "IFSC")}
      </fieldset>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label={tx("शुरुआती बाकी ₹", "Opening balance ₹")}>
          <NumInput value={f.openingAmount} disabled={!canEdit} onChange={(e) => set("openingAmount", e.target.value)} />
        </Field>
        <Field label={tx("बाकी की तरफ़", "Side")}>
          <Select value={f.openingSide} disabled={!canEdit} onChange={(e) => set("openingSide", e.target.value as "jama")}>
            <option value="jama">{tx("जमा (हमें देना)", "Jama (we owe)")}</option>
            <option value="naam">{tx("नाम (हमें लेना)", "Naam (owes us)")}</option>
          </Select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end">
          <input type="checkbox" data-skip checked={f.active} disabled={!canEdit} onChange={(e) => set("active", e.target.checked)} /> {tx("चालू", "Active")}
        </label>
      </div>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {tx("सेव", "Save")} (Ctrl+S)
          </Button>
        </div>
      ) : null}
    </KeyForm>
  );
}
