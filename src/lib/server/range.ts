import "server-only";
import { isIsoDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { Actor } from "./core";

/** Date range from the URL; operators only see their working day (PRD §2 "own day's list"). */
export function rangeFrom(sp: { from?: string; to?: string }, actor: Actor, wd: string) {
  if (!can(actor.role, "reports")) return { from: wd, to: wd, locked: true };
  const from = isIsoDate(sp.from) ? sp.from : wd;
  const to = isIsoDate(sp.to) ? sp.to : from > wd ? from : wd;
  return { from, to: to < from ? from : to, locked: false };
}
