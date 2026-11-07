"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveJins } from "@/actions/masters";
import { Button, Input, NumInput, Notice, Select, Table, tdCls, thCls } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

type Row = { id?: number; code: string; nameHi: string; nameEn: string; hsn: string; unit: string; feeGroup: string; bagKg: string; defaultTareKg: string; defaultMoisturePct: string; weighMode: string; mspRate: string; mspSeason: string; seq: number; active: boolean };

const blank: Row = { code: "", nameHi: "", nameEn: "", hsn: "", unit: "qtl", feeGroup: "A", bagKg: "50", defaultTareKg: "0", defaultMoisturePct: "0", weighMode: "total", mspRate: "", mspSeason: "", seq: 999, active: true };

export function JinsEditor({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const { tx } = useI18n();
  return (
    <Table>
      <thead>
        <tr>
          {[tx("कोड", "Code"), tx("नाम हिंदी", "Name Hindi"), tx("नाम English", "Name English"), "HSN", tx("शुल्क समूह", "Fee group"), tx("बोरी kg", "Bag kg"), tx("बोरी तौल kg", "Tare kg"), tx("नमी %", "Nami %"), tx("तुलाई", "Weighing"), "MSP ₹", tx("सीज़न", "Season"), tx("क्रम", "Seq"), tx("चालू", "Active"), ""].map((h, i) => (
            <th key={i} className={thCls}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <JinsRow key={r.id} row={r} canEdit={canEdit} />
        ))}
        {canEdit ? <JinsRow row={blank} canEdit isNew /> : null}
      </tbody>
    </Table>
  );
}

function JinsRow({ row, canEdit, isNew }: { row: Row; canEdit: boolean; isNew?: boolean }) {
  const { tx } = useI18n();
  const router = useRouter();
  const [r, setR] = useState(row);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof Row>(k: K, v: Row[K]) => setR({ ...r, [k]: v });
  const inp = (k: keyof Row, w = "w-24") => <Input className={`${w} min-h-9 px-2 py-1`} disabled={!canEdit} value={String(r[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />;
  const num = (k: keyof Row, w = "w-20") => <NumInput className={`${w} min-h-9 px-2 py-1`} disabled={!canEdit} value={String(r[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />;
  return (
    <tr className={isNew ? "bg-amber-50" : ""}>
      <td className={tdCls}>{inp("code", "w-24")}</td>
      <td className={tdCls}>{inp("nameHi", "w-28")}</td>
      <td className={tdCls}>{inp("nameEn", "w-28")}</td>
      <td className={tdCls}>{inp("hsn", "w-20")}</td>
      <td className={tdCls}>
        <Select className="min-h-9 w-20 px-2 py-1" disabled={!canEdit} value={r.feeGroup} onChange={(e) => set("feeGroup", e.target.value)}>
          <option value="A">A 1.60%</option>
          <option value="B">B 1.00%</option>
          <option value="C">C 0.50%</option>
        </Select>
      </td>
      <td className={tdCls}>{num("bagKg", "w-16")}</td>
      <td className={tdCls}>{num("defaultTareKg", "w-16")}</td>
      <td className={tdCls}>{num("defaultMoisturePct", "w-16")}</td>
      <td className={tdCls}>
        <Select className="min-h-9 w-28 px-2 py-1" disabled={!canEdit} value={r.weighMode} onChange={(e) => set("weighMode", e.target.value)}>
          <option value="total">{tx("कुल", "Total")}</option>
          <option value="bagwise">{tx("बोरी अनुसार", "Bag-wise")}</option>
        </Select>
      </td>
      <td className={tdCls}>{num("mspRate", "w-20")}</td>
      <td className={tdCls}>{inp("mspSeason", "w-24")}</td>
      <td className={tdCls}>{num("seq", "w-14")}</td>
      <td className={tdCls}>
        <input type="checkbox" disabled={!canEdit} checked={r.active} onChange={(e) => set("active", e.target.checked)} />
      </td>
      <td className={tdCls}>
        {canEdit ? (
          <Button
            className="min-h-9 px-3 py-1"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveJins({ ...r, mspRate: r.mspRate || null });
                setMsg(res.ok ? "✓" : res.error);
                if (res.ok) {
                  if (isNew) setR(blank);
                  router.refresh();
                }
              })
            }
          >
            {isNew ? tx("जोड़ें", "Add") : tx("सेव", "Save")}
          </Button>
        ) : null}
        {msg ? <div className="text-sm">{msg === "✓" ? <span className="text-jama">✓</span> : <Notice kind="error">{msg}</Notice>}</div> : null}
      </td>
    </tr>
  );
}
