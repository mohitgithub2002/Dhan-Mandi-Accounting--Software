"use client";
import { useI18n } from "@/lib/i18n/client";
import { Field, Input, NumInput, Select } from "./ui";

export type Mode = "cash" | "cheque" | "neft" | "upi";
export interface BankOpt {
  id: number;
  nameHi: string;
  nameEn: string;
}

/** Amount, mode (nakad / cheque / NEFT / UPI), bank and reference — shared by jama and naam. */
export function MoneyFields({
  amount,
  setAmount,
  mode,
  setMode,
  bankId,
  setBankId,
  refNo,
  setRefNo,
  banks,
}: {
  amount: string;
  setAmount: (v: string) => void;
  mode: Mode;
  setMode: (v: Mode) => void;
  bankId: number | null;
  setBankId: (v: number | null) => void;
  refNo: string;
  setRefNo: (v: string) => void;
  banks: BankOpt[];
}) {
  const { t, tx, lang } = useI18n();
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label={`${t("rakam")} ₹`}>
        <NumInput value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label={t("mode")}>
        <Select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as Mode;
            setMode(m);
            if (m !== "cash" && !bankId && banks[0]) setBankId(banks[0].id);
          }}
        >
          <option value="cash">{t("cash")}</option>
          <option value="cheque">{t("cheque")}</option>
          <option value="neft">{t("neft")}</option>
          <option value="upi">{t("upi")}</option>
        </Select>
      </Field>
      {mode !== "cash" ? (
        <Field label={t("bank")}>
          <Select value={bankId ?? ""} onChange={(e) => setBankId(Number(e.target.value) || null)}>
            <option value="">{tx("बैंक चुनें", "Choose bank")}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {lang === "en" ? b.nameEn || b.nameHi : b.nameHi || b.nameEn}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <span />
      )}
      {mode !== "cash" ? (
        <Field label={t("refNo")}>
          <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </Field>
      ) : (
        <span />
      )}
    </div>
  );
}
