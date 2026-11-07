"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLabel } from "@/actions/settings";
import { Button, Input, Table, tdCls, thCls } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

type Row = { key: string; hi: string; en: string; oHi: string; oEn: string };

export function LabelEditor({ rows }: { rows: Row[] }) {
  const { tx } = useI18n();
  const [filter, setFilter] = useState("");
  const shown = rows.filter((r) => !filter || [r.key, r.hi, r.en, r.oHi, r.oEn].some((x) => x.toLowerCase().includes(filter.toLowerCase())));
  return (
    <div className="flex flex-col gap-3">
      <Input placeholder={tx("खोजें", "Search")} value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
      <Table>
        <thead>
          <tr>
            <th className={thCls}>{tx("मूल शब्द", "Default")}</th>
            <th className={thCls}>{tx("फर्म का शब्द (हिंदी)", "Firm's word (Hindi)")}</th>
            <th className={thCls}>{tx("फर्म का शब्द (English)", "Firm's word (English)")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => <LabelRow key={r.key} r={r} />)}
        </tbody>
      </Table>
    </div>
  );
}

function LabelRow({ r }: { r: Row }) {
  const { tx } = useI18n();
  const router = useRouter();
  const [hi, setHi] = useState(r.oHi);
  const [en, setEn] = useState(r.oEn);
  const [ok, setOk] = useState("");
  const [pending, start] = useTransition();
  return (
    <tr>
      <td className={tdCls}>
        {r.hi} / {r.en}
        <div className="text-xs text-slate-400">{r.key}</div>
      </td>
      <td className={tdCls}><Input className="min-h-9 py-1" value={hi} placeholder={r.hi} onChange={(e) => setHi(e.target.value)} /></td>
      <td className={tdCls}><Input className="min-h-9 py-1" value={en} placeholder={r.en} onChange={(e) => setEn(e.target.value)} /></td>
      <td className={tdCls}>
        <Button
          variant="secondary"
          className="min-h-9 py-1"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveLabel({ key: r.key, textHi: hi, textEn: en });
              setOk(res.ok ? "✓" : res.error);
              if (res.ok) router.refresh();
            })
          }
        >
          {tx("सेव", "Save")}
        </Button>{" "}
        <span className="text-jama">{ok}</span>
      </td>
    </tr>
  );
}
