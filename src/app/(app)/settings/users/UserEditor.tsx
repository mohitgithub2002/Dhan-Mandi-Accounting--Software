"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveUser } from "@/actions/settings";
import { Badge, Button, Input, Notice, Select, Table, tdCls, thCls } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";

type U = { id?: number; name: string; mobile: string; role: string; lang: string; active: boolean; lastLoginAt?: string | null; locked?: boolean };
const ROLES: [string, string, string][] = [
  ["malik", "मालिक", "Malik (owner)"],
  ["munim", "मुनीम", "Munim (accountant)"],
  ["operator", "ऑपरेटर", "Operator"],
  ["ca", "सीए (केवल देखें)", "CA (view only)"],
];

export function UserEditor({ rows }: { rows: U[] }) {
  const { tx } = useI18n();
  return (
    <Table>
      <thead>
        <tr>
          {[tx("नाम", "Name"), tx("मोबाइल", "Mobile"), tx("भूमिका", "Role"), tx("भाषा", "Language"), tx("चालू", "Active"), tx("नया पासवर्ड", "New password"), ""].map((h, i) => (
            <th key={i} className={thCls}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => <UserRow key={u.id} u={u} />)}
        <UserRow u={{ name: "", mobile: "", role: "operator", lang: "hi", active: true }} isNew />
      </tbody>
    </Table>
  );
}

function UserRow({ u, isNew }: { u: U; isNew?: boolean }) {
  const { tx, lang } = useI18n();
  const router = useRouter();
  const [f, setF] = useState(u);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <tr className={isNew ? "bg-amber-50" : ""}>
      <td className={tdCls}>
        <Input className="min-h-9 py-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {u.locked ? <Badge tone="red">{tx("लॉक", "locked")}</Badge> : null}
      </td>
      <td className={tdCls}><Input className="min-h-9 w-36 py-1" inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></td>
      <td className={tdCls}>
        <Select className="min-h-9 py-1" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {ROLES.map(([k, hi, en]) => <option key={k} value={k}>{lang === "en" ? en : hi}</option>)}
        </Select>
      </td>
      <td className={tdCls}>
        <Select className="min-h-9 py-1" value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })}>
          <option value="hi">हिंदी</option>
          <option value="en">English</option>
        </Select>
      </td>
      <td className={tdCls}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /></td>
      <td className={tdCls}><Input className="min-h-9 w-36 py-1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></td>
      <td className={tdCls}>
        <Button
          className="min-h-9 py-1"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveUser({ ...f, password: pw || undefined, lastLoginAt: undefined, locked: undefined });
              setMsg(r.ok ? "✓" : r.error);
              if (r.ok) {
                setPw("");
                if (isNew) setF(u);
                router.refresh();
              }
            })
          }
        >
          {isNew ? tx("जोड़ें", "Add") : tx("सेव", "Save")}
        </Button>
        {msg ? <div className="mt-1 text-sm">{msg === "✓" ? <span className="text-jama">✓</span> : <Notice kind="error">{msg}</Notice>}</div> : null}
      </td>
    </tr>
  );
}
