import "server-only";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { cashCounts, dayCloses } from "@/db/schema";
import { m2, type Num } from "@/lib/calc";
import { can } from "@/lib/permissions";
import { audit, type Actor } from "./core";
import { fail } from "./errors";

/** Din band: munim or malik closes the day after checking rokad (PRD §5.13). */
export async function closeDay(tx: DbOrTx, actor: Actor, date: string) {
  if (!can(actor.role, "day_close")) fail("दिन बंद करने की अनुमति नहीं", "You cannot close the day");
  const [row] = await tx.select().from(dayCloses).where(eq(dayCloses.date, date));
  if (row?.isClosed) fail("दिन पहले से बंद है", "The day is already closed");
  const values = { isClosed: true, closedBy: actor.id, closedAt: new Date() };
  if (row) await tx.update(dayCloses).set(values).where(eq(dayCloses.date, date));
  else await tx.insert(dayCloses).values({ date, ...values });
  await audit(tx, actor, { table: "day_closes", rowId: date, action: "close" });
}

/** Only the malik reopens, with a reason (audit-logged). */
export async function reopenDay(tx: DbOrTx, actor: Actor, date: string, reason: string) {
  if (!can(actor.role, "day_reopen")) fail("दिन केवल मालिक खोल सकते हैं", "Only the malik can reopen a day");
  if (!reason.trim()) fail("दिन खोलने का कारण लिखें", "Write the reason for reopening");
  const [row] = await tx.select().from(dayCloses).where(eq(dayCloses.date, date));
  if (!row?.isClosed) fail("दिन बंद नहीं है", "The day is not closed");
  await tx
    .update(dayCloses)
    .set({ isClosed: false, reopenedBy: actor.id, reopenedAt: new Date(), reopenReason: reason })
    .where(eq(dayCloses.date, date));
  await audit(tx, actor, { table: "day_closes", rowId: date, action: "reopen", oldData: row, reason });
}

/** Physical cash count for the rokad (difference shown against book closing). */
export async function saveCashCount(tx: DbOrTx, actor: Actor, date: string, amount: Num) {
  if (!can(actor.role, "day_close")) fail("अनुमति नहीं", "Not allowed");
  const values = { amount: m2(amount), countedBy: actor.id, countedAt: new Date() };
  await tx.insert(cashCounts).values({ date, ...values }).onConflictDoUpdate({ target: cashCounts.date, set: values });
  await audit(tx, actor, { table: "cash_counts", rowId: date, action: "edit", newData: values });
}
