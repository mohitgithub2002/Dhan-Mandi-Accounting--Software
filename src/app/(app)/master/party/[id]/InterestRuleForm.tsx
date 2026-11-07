"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveInterestRule, stopInterest } from "@/actions/masters";
import { Badge, Button, Field, Input, NumInput, Notice, Select, Table, tdCls, thCls } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";

type Rule = { id: number; ratePm: string; method: string; graceDays: number; overdueOnly: boolean; effectiveFrom: string; active: boolean };

export function InterestRuleForm({ accountId, rules, canEdit, defaultDate }: { accountId: number; rules: Rule[]; canEdit: boolean; defaultDate: string }) {
  const { tx } = useI18n();
  const router = useRouter();
  const [rate, setRate] = useState("");
  const [method, setMethod] = useState("simple");
  const [grace, setGrace] = useState("0");
  const [overdue, setOverdue] = useState(false);
  const [from, setFrom] = useState(defaultDate);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "");
      else {
        setErr("");
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-3">
      {rules.length ? (
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{tx("से", "From")}</th>
              <th className={thCls}>{tx("दर % मासिक", "Rate % pm")}</th>
              <th className={thCls}>{tx("तरीका", "Method")}</th>
              <th className={thCls}>{tx("छूट दिन", "Grace days")}</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={r.active ? "" : "text-slate-400"}>
                <td className={tdCls}>{formatDate(r.effectiveFrom)}</td>
                <td className={tdCls}>{Number(r.ratePm)}</td>
                <td className={tdCls}>{r.method}{r.overdueOnly ? ` · ${tx("केवल उधार दिन बाद", "after credit days")}` : ""}</td>
                <td className={tdCls}>{r.graceDays}</td>
                <td className={tdCls}>{r.active ? <Badge tone="green">{tx("चालू", "active")}</Badge> : <Badge>{tx("बंद", "inactive")}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-slate-500">{tx("ब्याज नहीं लगता", "No byaj on this account")}</p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={tx("दर % प्रति माह", "Rate % per month")}>
            <NumInput className="w-28" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label={tx("तरीका", "Method")}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="simple">{tx("साधारण (दैनिक प्रोडक्ट)", "Simple (daily product)")}</option>
              <option value="monthly">{tx("मासिक", "Monthly")}</option>
              <option value="compound">{tx("चक्रवृद्धि (लगा ब्याज भी)", "Compound (on posted byaj too)")}</option>
            </Select>
          </Field>
          <Field label={tx("छूट दिन", "Grace days")}>
            <NumInput className="w-20" value={grace} onChange={(e) => setGrace(e.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> {tx("केवल उधार दिन के बाद (व्यापारी)", "Only after credit days (vyapari)")}
          </label>
          <Field label={tx("से", "From")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Button disabled={pending || !Number(rate)} onClick={() => run(() => saveInterestRule({ accountId, ratePm: rate, method, graceDays: grace, overdueOnly: overdue, effectiveFrom: from }))}>
            {tx("नियम सेव", "Save rule")}
          </Button>
          {rules.some((r) => r.active) ? (
            <Button variant="secondary" disabled={pending} onClick={() => run(() => stopInterest({ accountId }))}>
              {tx("ब्याज बंद", "Stop byaj")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {err ? <Notice kind="error">{err}</Notice> : null}
    </div>
  );
}
