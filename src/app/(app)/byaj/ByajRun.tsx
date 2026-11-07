"use client";
import { useState, useTransition } from "react";
import { byajPostAction, byajPreviewAction } from "@/actions/books";
import { Button, Card, Field, Input, Money, Notice, Select, Table, tdCls, thCls } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";

type Line = { accountId: number; name: string; partyType: string; from: string; to: string; ratePm: string; method: string; product: string; amount: string; note?: string };

export function ByajRun({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const { t, tx } = useI18n();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [type, setType] = useState("kisan");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const preview = () =>
    start(async () => {
      setMsg(null);
      const r = await byajPreviewAction({ from, to, partyType: type });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setLines(r.data);
      setPicked(new Set(r.data.map((l) => l.accountId)));
    });

  const post = () =>
    start(async () => {
      const r = await byajPostAction({ from, to, accountIds: [...picked] });
      if (!r.ok) return setMsg({ kind: "error", text: r.error });
      setMsg({ kind: "ok", text: `✓ ${r.data.count} ${tx("खातों में ब्याज लगा", "accounts charged")} · ₹${r.data.total}` });
      setLines(null);
    });

  const total = (lines ?? []).filter((l) => picked.has(l.accountId)).reduce((a, l) => a + Number(l.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("from")}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t("to")}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={tx("खाते", "Accounts")}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="kisan">{t("kisan")} ({t("peshgi")})</option>
              <option value="vyapari">{t("vyapari")} ({tx("बकाया", "overdue")})</option>
              <option value="">{tx("सभी", "All")}</option>
            </Select>
          </Field>
          <Button onClick={preview} disabled={pending}>
            {tx("हिसाब देखें", "Preview")}
          </Button>
        </div>
      </Card>
      {msg ? <Notice kind={msg.kind}>{msg.text}</Notice> : null}
      {lines ? (
        <Card title={tx("पूर्वावलोकन — चुने खातों में ब्याज लगेगा", "Preview — byaj will be posted to ticked accounts")}>
          {lines.length === 0 ? (
            <p>{tx("कोई ब्याज नहीं बनता", "No byaj due")}</p>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th className={thCls}>
                      <input type="checkbox" checked={picked.size === lines.length} onChange={(e) => setPicked(e.target.checked ? new Set(lines.map((l) => l.accountId)) : new Set())} />
                    </th>
                    <th className={thCls}>{tx("खाता", "Account")}</th>
                    <th className={thCls}>{tx("अवधि", "Period")}</th>
                    <th className={`${thCls} text-right`}>{tx("दर % मासिक", "Rate % pm")}</th>
                    <th className={`${thCls} text-right`}>{tx("प्रोडक्ट", "Product")}</th>
                    <th className={`${thCls} text-right`}>{t("byaj")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.accountId}>
                      <td className={tdCls}>
                        <input
                          type="checkbox"
                          checked={picked.has(l.accountId)}
                          onChange={(e) => {
                            const n = new Set(picked);
                            if (e.target.checked) n.add(l.accountId);
                            else n.delete(l.accountId);
                            setPicked(n);
                          }}
                        />
                      </td>
                      <td className={tdCls}>
                        {l.name} <span className="text-sm text-slate-500">#{l.accountId}</span>
                        {l.note ? <div className="text-sm text-amber-800">{l.note}</div> : null}
                      </td>
                      <td className={tdCls}>{formatDate(l.from)} – {formatDate(l.to)}</td>
                      <td className={`${tdCls} num`}>{Number(l.ratePm)} ({l.method})</td>
                      <td className={`${tdCls} num`}><Money value={l.product} /></td>
                      <td className={`${tdCls} num font-semibold`}><Money value={l.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-3 flex items-center justify-between">
                <b>
                  {t("total")}: ₹<Money value={total} />
                </b>
                <Button variant="success" disabled={pending || picked.size === 0} onClick={post}>
                  {tx("ब्याज लगाएं (पोस्ट)", "Post byaj")}
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
