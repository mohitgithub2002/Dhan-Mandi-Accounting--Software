import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { Badge, Card, Input, LinkButton, PageHeader, Select, Table, tdCls, thCls, Button } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { EDITABLE_PARTY_TYPES, PARTY_TYPE_LABEL } from "@/lib/partyTypes";
import { requirePage } from "@/lib/server/auth";

export default async function PartyList({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; inactive?: string }> }) {
  const actor = await requirePage("reports");
  const { tx, lang } = await getI18n();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const conds = [];
  if (sp.type) conds.push(eq(accounts.partyType, sp.type));
  if (sp.inactive !== "1") conds.push(eq(accounts.active, true));
  if (q) conds.push(or(ilike(accounts.nameHi, `%${q}%`), ilike(accounts.nameEn, `%${q}%`), ilike(accounts.village, `%${q}%`), ilike(accounts.mobile, `%${q}%`), /^\d+$/.test(q) ? eq(accounts.id, Number(q)) : sql`false`));
  const rows = await db.select().from(accounts).where(and(...conds)).orderBy(asc(accounts.partyType), asc(accounts.nameHi)).limit(300);
  const L = (k: string) => PARTY_TYPE_LABEL[k]?.[lang === "en" ? 1 : 0] ?? k;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={tx("खाता मास्टर", "Party master")}
        actions={can(actor.role, "party_edit") ? <LinkButton variant="primary" href={`/master/party/new${sp.type ? `?type=${sp.type}` : ""}`}>+ {tx("नया खाता", "New account")}</LinkButton> : null}
      />
      <form className="flex flex-wrap items-end gap-3">
        <Input name="q" defaultValue={q} placeholder={tx("नाम / गांव / मोबाइल / खाता नं.", "Name / village / mobile / khata no.")} className="max-w-md" />
        <Select name="type" defaultValue={sp.type ?? ""} className="max-w-56">
          <option value="">{tx("सभी प्रकार", "All types")}</option>
          {[...EDITABLE_PARTY_TYPES, "cash"].map((k) => (
            <option key={k} value={k}>{L(k)}</option>
          ))}
        </Select>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} /> {tx("बंद खाते भी", "Include inactive")}
        </label>
        <Button type="submit">{tx("खोजें", "Search")}</Button>
      </form>
      <Card>
        <Table>
          <thead>
            <tr>
              <th className={thCls}>{tx("खाता नं.", "Khata")}</th>
              <th className={thCls}>{tx("नाम", "Name")}</th>
              <th className={thCls}>{tx("प्रकार", "Type")}</th>
              <th className={thCls}>{tx("गांव", "Village")}</th>
              <th className={thCls}>{tx("मोबाइल", "Mobile")}</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={a.active ? "" : "text-slate-400"}>
                <td className={tdCls}>{a.id}</td>
                <td className={tdCls}>
                  <Link className="font-medium text-brand-700 underline" href={`/master/party/${a.id}`}>
                    {a.nameHi || a.nameEn}
                  </Link>{" "}
                  {a.nameHi && a.nameEn ? <span className="text-slate-500">/ {a.nameEn}</span> : null}
                  {a.isSystem ? <Badge>{tx("सिस्टम", "system")}</Badge> : null}
                </td>
                <td className={tdCls}>{L(a.partyType)}</td>
                <td className={tdCls}>{a.village}</td>
                <td className={tdCls}>{a.mobile}</td>
                <td className={tdCls}>
                  <Link className="underline" href={`/khata?account=${a.id}`}>{tx("खाता देखें", "Ledger")}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
