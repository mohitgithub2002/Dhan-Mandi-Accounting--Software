"use server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { customLabels, financialYears, firmSettings, shulkReturns, users } from "@/db/schema";
import { runAction } from "@/lib/server/action";
import { audit } from "@/lib/server/core";
import { fail } from "@/lib/server/errors";
import { runBackup } from "@/lib/server/backup";
import { parse, z, zDate, zId, zNum } from "@/lib/server/validate";

const firmSchema = z.object({
  nameHi: z.string().trim(),
  nameEn: z.string().trim(),
  licenceNo: z.string().trim(),
  addressHi: z.string().trim(),
  addressEn: z.string().trim(),
  phone: z.string().trim(),
  pan: z.string().trim().toUpperCase(),
  gstin: z.string().trim().toUpperCase(),
  logo: z.string().nullable().optional(),
  footerText: z.string(),
  defaultLang: z.enum(["hi", "en", "both"]),
  parchiMode: z.enum(["per_day", "per_dheri"]),
  billMode: z.enum(["per_day", "per_dheri"]),
  parchiLayout: z.enum(["full", "half"]),
  totalRounding: z.enum(["none", "nearest_1", "nearest_0_10", "up_1"]),
  bhavWarnPct: zNum,
  cashLimit: zNum,
  byajDaysInMonth: z.coerce.number().int().min(28).max(31),
  sarkariCreditKisan: z.boolean(),
});

export async function saveFirm(input: unknown) {
  return runAction("admin", async (tx, actor) => {
    const i = parse(firmSchema, input);
    if (i.logo && i.logo.length > 300_000) fail("लोगो बहुत बड़ा है (200KB तक)", "Logo is too large (max 200 KB)");
    if (i.logo && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(i.logo)) fail("लोगो PNG/JPG हो", "Logo must be PNG/JPG");
    const [old] = await tx.select().from(firmSettings).where(eq(firmSettings.id, 1));
    await tx.update(firmSettings).set({ ...i, updatedAt: new Date() }).where(eq(firmSettings.id, 1));
    await audit(tx, actor, { table: "firm_settings", rowId: 1, action: "edit", oldData: { ...old, logo: old?.logo ? "[logo]" : null }, newData: { ...i, logo: i.logo ? "[logo]" : null } });
    return true;
  });
}

export async function saveUser(input: unknown) {
  return runAction("admin", async (tx, actor) => {
    const i = parse(
      z.object({
        id: zId.optional(),
        name: z.string().trim().min(1),
        mobile: z.string().trim().regex(/^\d{10}$/),
        role: z.enum(["malik", "munim", "operator", "ca"]),
        lang: z.enum(["hi", "en"]),
        active: z.boolean(),
        password: z.string().optional(),
      }),
      input,
    );
    if (i.id === actor.id && (i.role !== "malik" || !i.active)) fail("अपना मालिक अधिकार नहीं हटा सकते", "You cannot remove your own malik access");
    const { id, password, ...v } = i;
    if (password !== undefined && password !== "" && password.length < 6) fail("पासवर्ड कम से कम 6 अक्षर", "Password must be at least 6 characters");
    const hash = password ? await bcrypt.hash(password, 10) : undefined;
    try {
      if (id) {
        await tx.update(users).set({ ...v, ...(hash ? { passwordHash: hash, failedAttempts: 0, lockedUntil: null } : {}) }).where(eq(users.id, id));
        await audit(tx, actor, { table: "users", rowId: id, action: "edit", newData: { ...v, passwordChanged: !!hash } });
        return { id };
      }
      if (!hash) fail("पासवर्ड डालें", "Enter a password");
      const [row] = await tx.insert(users).values({ ...v, passwordHash: hash! }).returning();
      await audit(tx, actor, { table: "users", rowId: row.id, action: "create", newData: v });
      return { id: row.id };
    } catch (e) {
      if (/users_mobile_unique|duplicate key/.test(String((e as Error & { cause?: Error }).cause?.message ?? e))) fail("यह मोबाइल पहले से है", "This mobile is already a user");
      throw e;
    }
  });
}

/** Shabd: the malik renames screen words (PRD §3). */
export async function saveLabel(input: { key: string; textHi: string; textEn: string }) {
  return runAction("admin", async (tx, actor) => {
    const i = parse(z.object({ key: z.string().min(1), textHi: z.string().trim(), textEn: z.string().trim() }), input);
    if (!i.textHi && !i.textEn) {
      await tx.delete(customLabels).where(eq(customLabels.key, i.key));
    } else {
      await tx.insert(customLabels).values(i).onConflictDoUpdate({ target: customLabels.key, set: { textHi: i.textHi, textEn: i.textEn } });
    }
    await audit(tx, actor, { table: "custom_labels", rowId: i.key, action: "edit", newData: i });
    return true;
  });
}

export async function setFyLock(input: { id: number; locked: boolean; reason: string }) {
  return runAction("admin", async (tx, actor) => {
    const i = parse(z.object({ id: zId, locked: z.boolean(), reason: z.string() }), input);
    if (!i.locked && !i.reason.trim()) fail("खोलने का कारण लिखें", "Write the reason to unlock");
    await tx.update(financialYears).set({ isLocked: i.locked }).where(eq(financialYears.id, i.id));
    await audit(tx, actor, { table: "financial_years", rowId: i.id, action: i.locked ? "lock" : "unlock", reason: i.reason });
    return true;
  });
}

export async function saveShulkReturn(input: unknown) {
  return runAction("day_close", async (tx, actor) => {
    const i = parse(z.object({ periodFrom: zDate, periodTo: zDate, challanNo: z.string().trim().min(1), challanDate: zDate, amount: zNum, remarks: z.string().default("") }), input);
    const [row] = await tx.insert(shulkReturns).values({ ...i, createdBy: actor.id }).returning();
    await audit(tx, actor, { table: "shulk_returns", rowId: row.id, action: "create", newData: row });
    return { id: row.id };
  });
}

export async function backupNow() {
  return runAction("admin", async (tx, actor) => runBackup(tx, actor, "manual"), { revalidate: ["/"] });
}
