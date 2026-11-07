import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { customLabels } from "@/db/schema";
import { currentActor } from "@/lib/server/auth";
import { makeT, pick, type Lang } from "./dict";

export const getOverrides = cache(async () => {
  try {
    const rows = await db.select().from(customLabels);
    return Object.fromEntries(rows.map((r) => [r.key, { hi: r.textHi, en: r.textEn }]));
  } catch {
    return {};
  }
});

/** Language and translators for a server component. */
export async function getI18n() {
  const actor = await currentActor();
  const lang: Lang = actor?.lang === "en" ? "en" : "hi";
  const overrides = await getOverrides();
  return { lang, t: makeT(lang, overrides), tx: pick(lang), overrides };
}
