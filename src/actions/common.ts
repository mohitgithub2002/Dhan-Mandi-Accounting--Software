"use server";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accountGroups, accounts, users } from "@/db/schema";
import { isIsoDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { runAction } from "@/lib/server/action";
import { currentActor, login, logout, refreshSessionCookie } from "@/lib/server/auth";
import { audit } from "@/lib/server/core";
import { fail, toMessage } from "@/lib/server/errors";
import { WORKING_DATE_COOKIE } from "@/lib/session";

export interface PartyHit {
  id: number;
  nameHi: string;
  nameEn: string;
  fatherName: string;
  village: string;
  mobile: string;
  partyType: string;
}

/**
 * F2 party search: name in Hindi or English, gaon, mobile or khata number (PRD §5.1).
 * Roman typing finds Hindi names through the stored English name (PRD §9 rule 3).
 */
export async function searchParties(q: string, types: string[] = []): Promise<PartyHit[]> {
  const actor = await currentActor();
  if (!actor) return [];
  const term = q.trim();
  const conds = [eq(accounts.active, true)];
  if (types.length) conds.push(inArray(accounts.partyType, types));
  if (term) {
    const like = `%${term}%`;
    conds.push(
      or(
        ilike(accounts.nameHi, like),
        ilike(accounts.nameEn, like),
        ilike(accounts.village, like),
        ilike(accounts.mobile, like),
        /^\d+$/.test(term) ? eq(accounts.id, Number(term)) : sql`false`,
      )!,
    );
  }
  const rows = await db
    .select({
      id: accounts.id,
      nameHi: accounts.nameHi,
      nameEn: accounts.nameEn,
      fatherName: accounts.fatherName,
      village: accounts.village,
      mobile: accounts.mobile,
      partyType: accounts.partyType,
    })
    .from(accounts)
    .where(and(...conds))
    .orderBy(
      term
        ? sql`GREATEST(similarity(${accounts.nameEn}, ${term}), similarity(${accounts.nameHi}, ${term})) DESC`
        : accounts.nameHi,
      accounts.id,
    )
    .limit(15);
  return rows;
}

const GROUP_FOR: Record<string, string> = {
  kisan: "KISAN",
  vyapari: "VYAPARI",
  agency: "AGENCY",
  labour: "LABOUR",
  transporter: "TRANSPORTER",
  bank: "BANK",
  expense: "EXPENSE",
  income: "INCOME",
};

/** Quick-add a kisan (or vyapari): only name, gaon and mobile needed (PRD §5.2). */
export async function quickAddParty(input: { partyType: string; name: string; village: string; mobile: string }) {
  return runAction("party_quick_add", async (tx, actor) => {
    const name = input.name.trim();
    if (!name) fail("नाम डालें", "Enter the name");
    if (!["kisan", "vyapari"].includes(input.partyType)) fail("ग़लत प्रकार", "Wrong party type");
    if (input.partyType === "vyapari" && !can(actor.role, "party_edit")) fail("अनुमति नहीं", "Not allowed");
    const mobile = input.mobile.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) fail("मोबाइल 10 अंक का हो", "Mobile must be 10 digits");
    const [g] = await tx.select().from(accountGroups).where(eq(accountGroups.code, GROUP_FOR[input.partyType]));
    const isHindi = /[ऀ-ॿ]/.test(name);
    const [row] = await tx
      .insert(accounts)
      .values({
        groupId: g.id,
        partyType: input.partyType,
        nameHi: isHindi ? name : "",
        nameEn: isHindi ? "" : name,
        village: input.village.trim(),
        mobile,
      })
      .returning();
    await audit(tx, actor, { table: "accounts", rowId: row.id, action: "create", newData: row });
    return {
      id: row.id,
      nameHi: row.nameHi,
      nameEn: row.nameEn,
      fatherName: row.fatherName,
      village: row.village,
      mobile: row.mobile,
      partyType: row.partyType,
    } satisfies PartyHit;
  });
}

export async function loginAction(_prev: { error?: string } | undefined, form: FormData) {
  const next = String(form.get("next") || "/");
  try {
    await login(String(form.get("mobile") ?? ""), String(form.get("password") ?? ""));
  } catch (e) {
    return { error: toMessage(e, String(form.get("lang") ?? "hi")) };
  }
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

/** Language toggle, remembered per user (PRD §9 rule 2). */
export async function setLang(lang: "hi" | "en") {
  const actor = await currentActor();
  if (!actor) return;
  await db.update(users).set({ lang }).where(eq(users.id, actor.id));
  await refreshSessionCookie({ ...actor, lang });
}

/** Back-entry: munim / malik change the working date (PRD §9 rule 10). */
export async function setWorkingDate(date: string) {
  const actor = await currentActor();
  if (!actor || !can(actor.role, "back_date") || !isIsoDate(date)) return;
  const jar = await cookies();
  jar.set(WORKING_DATE_COOKIE, date, { path: "/", sameSite: "lax", httpOnly: true });
}
