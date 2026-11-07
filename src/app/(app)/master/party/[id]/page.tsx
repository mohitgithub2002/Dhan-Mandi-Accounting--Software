import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { accounts, interestRules } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { requirePage, workingDate } from "@/lib/server/auth";
import { PartyForm, type PartyData } from "./PartyForm";
import { InterestRuleForm } from "./InterestRuleForm";

export default async function PartyEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const actor = await requirePage("reports");
  const { tx } = await getI18n();
  const { id } = await params;
  const sp = await searchParams;
  const wd = await workingDate(actor);
  const isNew = id === "new";
  const [acc] = isNew ? [null] : await db.select().from(accounts).where(eq(accounts.id, Number(id)));
  if (!isNew && !acc) notFound();
  const rules = acc ? await db.select().from(interestRules).where(eq(interestRules.accountId, acc.id)).orderBy(desc(interestRules.effectiveFrom)) : [];
  const canEdit = can(actor.role, "party_edit");
  const showBank = can(actor.role, "party_edit");
  const data: PartyData = acc
    ? {
        id: acc.id, partyType: acc.partyType, nameHi: acc.nameHi, nameEn: acc.nameEn, fatherName: acc.fatherName, village: acc.village, tehsil: acc.tehsil,
        mobile: acc.mobile, pan: acc.pan, aadhaarLast4: acc.aadhaarLast4, bankName: showBank ? acc.bankName : "", bankAc: showBank ? acc.bankAc : "",
        ifsc: showBank ? acc.ifsc : "", gstin: acc.gstin, licenceNo: acc.licenceNo, openingAmount: acc.openingAmount, openingSide: acc.openingSide as "jama",
        creditDays: acc.creditDays, active: acc.active, isSystem: acc.isSystem,
      }
    : {
        partyType: sp.type ?? "kisan", nameHi: "", nameEn: "", fatherName: "", village: "", tehsil: "", mobile: "", pan: "", aadhaarLast4: "", bankName: "",
        bankAc: "", ifsc: "", gstin: "", licenceNo: "", openingAmount: "0", openingSide: "jama", creditDays: 0, active: true, isSystem: false,
      };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={isNew ? tx("नया खाता", "New account") : `${tx("खाता", "Account")} #${acc!.id}`} />
      <Card>
        <PartyForm data={data} canEdit={canEdit} />
      </Card>
      {acc ? (
        <Card title={tx("ब्याज नियम", "Byaj rule")}>
          <InterestRuleForm accountId={acc.id} rules={rules.map((r) => ({ id: r.id, ratePm: r.ratePm, method: r.method, graceDays: r.graceDays, overdueOnly: r.overdueOnly, effectiveFrom: r.effectiveFrom, active: r.active }))} canEdit={canEdit} defaultDate={wd} />
        </Card>
      ) : null}
    </div>
  );
}
