/** Amount in words, Indian system (crore / lakh / thousand), Hindi and English (PRD §8). */
import { D, d, type Num } from "./money";

const EN_ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const HI_0_99 = (
  "शून्य एक दो तीन चार पांच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस " +
  "बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस " +
  "पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस " +
  "अड़तालीस उनचास पचास इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरेसठ " +
  "चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर " +
  "अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे " +
  "बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split(" ");

function en99(n: number): string {
  if (n < 20) return EN_ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return EN_TENS[t] + (o ? " " + EN_ONES[o] : "");
}

type Lang = "hi" | "en";

function below1000(n: number, lang: Lang): string[] {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(lang === "hi" ? `${HI_0_99[h]} सौ` : `${EN_ONES[h]} Hundred`);
  if (rest) parts.push(lang === "hi" ? HI_0_99[rest] : en99(rest));
  return parts;
}

/** Words for a whole number using crore / lakh / hazaar / sau. */
export function integerToWords(nIn: number | bigint, lang: Lang): string {
  let n = BigInt(nIn);
  if (n === 0n) return lang === "hi" ? HI_0_99[0] : EN_ONES[0];
  const parts: string[] = [];
  const crore = n / 10000000n;
  n %= 10000000n;
  if (crore > 0n) {
    parts.push(integerToWords(crore, lang), lang === "hi" ? "करोड़" : "Crore");
  }
  const lakh = Number(n / 100000n);
  n %= 100000n;
  if (lakh) parts.push(lang === "hi" ? HI_0_99[lakh] : en99(lakh), lang === "hi" ? "लाख" : "Lakh");
  const thousand = Number(n / 1000n);
  n %= 1000n;
  if (thousand) parts.push(lang === "hi" ? HI_0_99[thousand] : en99(thousand), lang === "hi" ? "हज़ार" : "Thousand");
  parts.push(...below1000(Number(n), lang));
  return parts.join(" ");
}

/**
 * "एक लाख बाईस हज़ार पांच सौ रुपये" / "One Lakh Twenty Two Thousand Five Hundred Rupees".
 * Paise are added when present.
 */
export function amountInWords(v: Num, lang: Lang): string {
  const x = d(v).abs().toDecimalPlaces(2, D.ROUND_HALF_UP);
  const rupees = BigInt(x.floor().toFixed(0));
  const paise = Number(x.minus(x.floor()).times(100).toFixed(0));
  const neg = d(v).isNegative() && !d(v).isZero();
  let s =
    lang === "hi"
      ? `${integerToWords(rupees, "hi")} रुपये`
      : `${integerToWords(rupees, "en")} Rupees`;
  if (paise) s += lang === "hi" ? ` ${HI_0_99[paise]} पैसे` : ` and ${en99(paise)} Paise`;
  if (neg) s = (lang === "hi" ? "ऋण " : "Minus ") + s;
  return s;
}
