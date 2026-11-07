"use server";
import { runAction } from "@/lib/server/action";
import { postByaj, previewByaj } from "@/lib/server/byaj";
import { requireActor } from "@/lib/server/auth";
import { db } from "@/db";
import { closeDay, reopenDay, saveCashCount } from "@/lib/server/dayclose";
import { parse, z, zDate, zId, zNum } from "@/lib/server/validate";
import { toMessage } from "@/lib/server/errors";

export async function closeDayAction(date: string) {
  return runAction("day_close", async (tx, actor) => {
    await closeDay(tx, actor, parse(zDate, date));
    return true;
  });
}

export async function reopenDayAction(input: { date: string; reason: string }) {
  return runAction("day_reopen", async (tx, actor) => {
    const i = parse(z.object({ date: zDate, reason: z.string() }), input);
    await reopenDay(tx, actor, i.date, i.reason);
    return true;
  });
}

export async function cashCountAction(input: { date: string; amount: string }) {
  return runAction("day_close", async (tx, actor) => {
    const i = parse(z.object({ date: zDate, amount: zNum }), input);
    await saveCashCount(tx, actor, i.date, i.amount);
    return true;
  });
}

export async function byajPreviewAction(input: { from: string; to: string; partyType?: string }) {
  const actor = await requireActor("byaj").catch((e) => e);
  if (actor instanceof Error) return { ok: false as const, error: toMessage(actor, "hi") };
  try {
    const i = parse(z.object({ from: zDate, to: zDate, partyType: z.string().optional() }), input);
    return { ok: true as const, data: await previewByaj(db, { from: i.from, to: i.to, partyType: i.partyType || undefined }) };
  } catch (e) {
    return { ok: false as const, error: toMessage(e, actor.lang) };
  }
}

export async function byajPostAction(input: { from: string; to: string; accountIds: number[] }) {
  return runAction("byaj", async (tx, actor) => {
    const i = parse(z.object({ from: zDate, to: zDate, accountIds: z.array(zId).min(1) }), input);
    return postByaj(tx, actor, i);
  });
}
