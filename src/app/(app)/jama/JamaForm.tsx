"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { partyInfo, receiptAction } from "@/actions/money";
import { KeyForm } from "@/components/KeyForm";
import { MoneyFields, type BankOpt, type Mode } from "@/components/MoneyFields";
import { PartySearch, type PartyHit } from "@/components/PartySearch";
import { Balance, Button, Field, Input, NumInput, Notice, Table, tdCls, thCls } from "@/components/ui";
import { formatINR } from "@/lib/calc";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";

type Info = Awaited<ReturnType<typeof partyInfo>>;

export function JamaForm({ date, banks }: { date: string; banks: BankOpt[] }) {
  const { t, tx, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [party, setParty] = useState<PartyHit | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Mode>("neft");
  const [bankId, setBankId] = useState<number | null>(banks[0]?.id ?? null);
  const [refNo, setRefNo] = useState("");
  const [tdsQ, setTdsQ] = useState("");
  const [tdsH, setTdsH] = useState("");
  const [narration, setNarration] = useState("");
  const [manual, setManual] = useState(false);
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error" | "warn"; text: React.ReactNode } | null>(null);

  useEffect(() => {
    setInfo(null);
    setAlloc({});
    if (party) partyInfo(party.id).then(setInfo).catch(() => setInfo(null));
  }, [party]);

  function save() {
    if (!party) return setMsg({ kind: "error", text: tx("खाता चुनें", "Choose the party") });
    if (!Number(amount)) return setMsg({ kind: "error", text: tx("रकम डालें", "Enter the amount") });
    start(async () => {
      const r = await receiptAction({
        date,
        partyId: party.id,
        amount,
        mode,
        bankAccountId: mode === "cash" ? null : bankId,
        refNo,
        narration,
        tds194Q: tdsQ || "0",
        tds194H: tdsH || "0",
        allocation: manual ? Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([billId, v]) => ({ billId: Number(billId), amount: v })) : "auto",
      });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({
        kind: r.warnings?.length ? "warn" : "ok",
        text: (
          <>
            ✓ {t("jama")} #{r.data.no} {r.warnings?.join(" ")}{" "}
            <a className="underline" target="_blank" href={`/print/raseed/${r.data.id}`}>
              {t("raseed")}
            </a>
          </>
        ),
      });
      setParty(null);
      setAmount("");
      setRefNo("");
      setTdsQ("");
      setTdsH("");
      setNarration("");
      router.refresh();
    });
  }

  return (
    <KeyForm
      dirty={!!party}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Field label={`${tx("किससे", "From")} (F2)`}>
          <PartySearch types={["vyapari", "agency", "kisan", "labour", "transporter", "other"]} value={party} onChange={setParty} autoFocus />
        </Field>
        <div className="self-end pb-2">{info ? <>{t("balance")}: <Balance value={info.balance} lang={lang} /></> : null}</div>
      </div>
      <MoneyFields {...{ amount, setAmount, mode, setMode, bankId, setBankId, refNo, setRefNo, banks }} />
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={tx("TDS 194Q (ख़रीद पर)", "TDS 194Q (on purchase)")}>
          <NumInput value={tdsQ} onChange={(e) => setTdsQ(e.target.value)} />
        </Field>
        <Field label={tx("TDS 194H (आढ़त पर)", "TDS 194H (on commission)")}>
          <NumInput value={tdsH} onChange={(e) => setTdsH(e.target.value)} />
        </Field>
        <Field label={t("narration")}>
          <Input value={narration} onChange={(e) => setNarration(e.target.value)} />
        </Field>
      </div>
      {info && info.bills.length ? (
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center gap-4">
            <b>{tx("बकाया बिल", "Open bills")}</b>
            <label className="flex items-center gap-1">
              <input type="radio" data-skip checked={!manual} onChange={() => setManual(false)} /> {tx("पुराने पहले (ऑटो)", "Oldest first (auto)")}
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" data-skip checked={manual} onChange={() => setManual(true)} /> {tx("बिल चुनें", "Pick bills")}
            </label>
          </div>
          <Table>
            <thead>
              <tr>
                <th className={thCls}>{tx("बिल", "Bill")}</th>
                <th className={thCls}>{t("date")}</th>
                <th className={thCls}>{tx("देय तिथि", "Due")}</th>
                <th className={`${thCls} text-right`}>{t("total")}</th>
                <th className={`${thCls} text-right`}>{tx("बकाया", "Pending")}</th>
                {manual ? <th className={thCls}>{tx("इस जमा से", "From this receipt")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {info.bills.map((b) => (
                <tr key={b.id}>
                  <td className={tdCls}>#{b.billNo}</td>
                  <td className={tdCls}>{formatDate(b.date)}</td>
                  <td className={tdCls}>{formatDate(b.dueDate)}</td>
                  <td className={`${tdCls} num`}>{formatINR(b.total)}</td>
                  <td className={`${tdCls} num`}>{formatINR(b.pending)}</td>
                  {manual ? (
                    <td className={tdCls}>
                      <NumInput data-skip className="w-32" value={alloc[b.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [b.id]: e.target.value })} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
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
