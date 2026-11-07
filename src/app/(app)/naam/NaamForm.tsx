"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { contraAction, partyInfo, paymentAction } from "@/actions/money";
import { KeyForm } from "@/components/KeyForm";
import { MoneyFields, type BankOpt, type Mode } from "@/components/MoneyFields";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Balance, Button, Field, Input, NumInput, Notice, Select } from "@/components/ui";
import { formatINR } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";

export type Tab = "naam" | "peshgi" | "kharcha" | "contra";
type Info = Awaited<ReturnType<typeof partyInfo>>;
type Head = { id: number; code: string | null; nameHi: string; nameEn: string; partyType: string };

export function NaamForm({ tab, date, banks, heads, cashId }: { tab: Tab; date: string; banks: BankOpt[]; heads: Head[]; cashId: number }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [party, setParty] = useState<PartyHit | null>(null);
  const [headId, setHeadId] = useState<number | null>(heads[0]?.id ?? null);
  const [info, setInfo] = useState<Info | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Mode>("cash");
  const [bankId, setBankId] = useState<number | null>(banks[0]?.id ?? null);
  const [refNo, setRefNo] = useState("");
  const [narration, setNarration] = useState("");
  const [byaj, setByaj] = useState("");
  const [fromId, setFromId] = useState<number>(cashId);
  const [toId, setToId] = useState<number>(banks[0]?.id ?? cashId);
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "warn"; text: React.ReactNode } | null>(null);

  useEffect(() => {
    setInfo(null);
    if (party)
      partyInfo(party.id)
        .then((i) => {
          setInfo(i);
          if (tab === "peshgi" && i.byajRate) setByaj(String(Number(i.byajRate)));
        })
        .catch(() => setInfo(null));
  }, [party, tab]);

  const nm = (a: { nameHi: string; nameEn: string }) => (lang === "en" ? a.nameEn || a.nameHi : a.nameHi || a.nameEn);
  const moneyAccts = [{ id: cashId, nameHi: "रोकड़ (नकद)", nameEn: "Cash" }, ...banks];

  function done(r: Awaited<ReturnType<typeof paymentAction>>) {
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({
      kind: r.warnings?.length ? "warn" : "ok",
      text: (
        <>
          ✓ #{r.data.no} {r.warnings?.join(" ")}{" "}
          <a className="underline" target="_blank" href={`/print/raseed/${r.data.id}`}>
            {t("raseed")}
          </a>
        </>
      ),
    });
    setParty(null);
    setAmount("");
    setRefNo("");
    setNarration("");
    router.refresh();
  }

  function save() {
    if (!Number(amount)) return setMsg({ kind: "error", text: tx("रकम डालें", "Enter the amount") });
    start(async () => {
      if (tab === "contra") {
        done(await contraAction({ date, fromAccountId: fromId, toAccountId: toId, amount, refNo, narration }));
        return;
      }
      const accountId = tab === "kharcha" ? headId : party?.id;
      if (!accountId) return setMsg({ kind: "error", text: tx("खाता चुनें", "Choose the account") });
      done(
        await paymentAction({
          date,
          kind: tab,
          accountId,
          amount,
          mode,
          bankAccountId: mode === "cash" ? null : bankId,
          refNo,
          narration,
          byajRatePm: tab === "peshgi" && byaj ? byaj : null,
        }),
      );
    });
  }

  return (
    <KeyForm
      dirty={!!party || !!amount}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3"
    >
      {tab === "naam" || tab === "peshgi" ? (
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <Field label={`${tab === "peshgi" ? t("kisan") : tx("किसको", "To")} (F2)`}>
            <PartySearch types={tab === "peshgi" ? ["kisan"] : ["kisan", "labour", "transporter", "vyapari", "other"]} value={party} onChange={setParty} autoFocus />
          </Field>
          <div className="self-end pb-2">{info ? <>{t("balance")}: <Balance value={info.balance} lang={lang} /></> : null}</div>
        </div>
      ) : null}
      {tab === "kharcha" ? (
        <Field label={tx("खर्चे का खाता", "Expense / payable head")}>
          <Select autoFocus value={headId ?? ""} onChange={(e) => setHeadId(Number(e.target.value))}>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>
                {nm(h)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {tab === "contra" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={tx("कहां से", "From")}>
            <Select autoFocus value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>
              {moneyAccts.map((a) => (
                <option key={a.id} value={a.id}>{nm(a)}</option>
              ))}
            </Select>
          </Field>
          <Field label={tx("कहां", "To")}>
            <Select value={toId} onChange={(e) => setToId(Number(e.target.value))}>
              {moneyAccts.map((a) => (
                <option key={a.id} value={a.id}>{nm(a)}</option>
              ))}
            </Select>
          </Field>
          <Field label={`${t("rakam")} ₹`}>
            <NumInput value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
      ) : (
        <MoneyFields {...{ amount, setAmount, mode, setMode, bankId, setBankId, refNo, setRefNo, banks }} />
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {tab === "peshgi" ? (
          <Field label={tx("ब्याज % प्रति माह", "Byaj % per month")} hint={tx("₹1 = ₹100 पर ₹1 महीना", "1.00 = ₹1 per ₹100 per month")}>
            <NumInput value={byaj} onChange={(e) => setByaj(e.target.value)} />
          </Field>
        ) : null}
        <Field label={tab === "peshgi" ? tx("मकसद / विवरण", "Purpose / narration") : t("narration")} className="md:col-span-2">
          <Input value={narration} onChange={(e) => setNarration(e.target.value)} />
        </Field>
      </div>
      {info && info.recentParchis.length && tab === "naam" ? (
        <div className="text-sm text-slate-600">
          {tx("हाल की पर्चियां", "Recent parchis")}:{" "}
          {info.recentParchis.map((p) => `#${p.no} (${formatDate(p.date)}) ₹${formatINR(p.payable)}`).join(" · ")}
        </div>
      ) : null}
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {t("save")} (Ctrl+S)
        </Button>
      </div>
    </KeyForm>
  );
}
