import "server-only";
import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { fail } from "./errors";

/** Parse action input; a bad shape becomes a plain message instead of a crash. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const f = r.error.issues[0];
    fail(`जानकारी ठीक नहीं: ${f?.path.join(".")}`, `Invalid input: ${f?.path.join(".")} — ${f?.message}`);
  }
  return r.data!;
}

export const zDate = z.string().refine(isIsoDate, "date");
export const zId = z.coerce.number().int().positive();
export const zNum = z.union([z.string(), z.number()]).transform((v) => String(v ?? "").replace(/,/g, "").trim() || "0").refine((v) => /^-?\d*\.?\d*$/.test(v), "number");
export const zOptNum = zNum.optional();
export { z };
