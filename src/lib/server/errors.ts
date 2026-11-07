/** An error whose message is safe to show the user, in both languages (PRD §9 rule 8). */
export class AppError extends Error {
  constructor(
    public hi: string,
    public en: string,
  ) {
    super(en);
    this.name = "AppError";
  }
}

export const fail = (hi: string, en: string): never => {
  throw new AppError(hi, en);
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T; warnings?: string[] }
  | { ok: false; error: string };

/** Full text of an error and its causes (drizzle wraps driver errors). */
export function errorText(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; cur && i < 5; i++) {
    parts.push(cur instanceof Error ? cur.message : String(cur));
    cur = cur instanceof Error ? (cur as Error & { cause?: unknown }).cause : undefined;
  }
  return parts.join(" | ");
}

/** Turn any thrown error into a plain message in the user's language. */
export function toMessage(e: unknown, lang: string): string {
  if (e instanceof AppError) return lang === "en" ? e.en : e.hi;
  const msg = errorText(e);
  if (/not balanced/i.test(msg)) return lang === "en" ? "Entry does not balance. Nothing was saved." : "एंट्री का जोड़ बराबर नहीं है। कुछ सेव नहीं हुआ।";
  console.error(e);
  return lang === "en" ? "Something went wrong. Please try again." : "कुछ गड़बड़ हुई। दोबारा कोशिश करें।";
}
