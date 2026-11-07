import "server-only";
import { revalidatePath } from "next/cache";
import { db, type Tx } from "@/db";
import type { Permission } from "@/lib/permissions";
import { currentActor, requireActor } from "./auth";
import type { Actor } from "./core";
import { toMessage, type ActionResult } from "./errors";

/**
 * Run a server action body: check the role, run inside one DB transaction
 * (all or nothing — PRD §10), and turn errors into a plain message.
 */
export async function runAction<T>(
  perm: Permission | null,
  fn: (tx: Tx, actor: Actor) => Promise<T | { data: T; warnings?: string[] }>,
  opts: { revalidate?: string[]; raw?: boolean } = {},
): Promise<ActionResult<T>> {
  let lang = "hi";
  try {
    const actor = await requireActor(perm ?? undefined);
    lang = actor.lang;
    const out = await db.transaction((tx) => fn(tx, actor));
    for (const p of opts.revalidate ?? ["/"]) revalidatePath(p, "layout");
    if (!opts.raw && out && typeof out === "object" && "data" in (out as object) && "warnings" in (out as object)) {
      const o = out as { data: T; warnings?: string[] };
      return { ok: true, data: o.data, warnings: o.warnings };
    }
    return { ok: true, data: out as T };
  } catch (e) {
    const a = await currentActor().catch(() => null);
    return { ok: false, error: toMessage(e, a?.lang ?? lang) };
  }
}
