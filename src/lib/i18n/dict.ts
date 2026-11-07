/**
 * Shabdavali (PRD §3): the mandi words used as menu items, field labels and
 * print headings. [Hindi, English]. English shows the Hindi word in brackets
 * where staff know only the Hindi. The malik can rename any key in
 * Settings → Shabd (custom_labels table).
 */
export const DICT = {
  // shabdavali
  aamad: ["आमद", "Arrival (Aamad)"],
  dheri: ["ढेरी", "Lot (Dheri)"],
  jins: ["जिंस", "Commodity (Jins)"],
  boli: ["बोली", "Auction (Boli)"],
  bhav: ["भाव", "Rate (Bhav)"],
  tulai: ["तुलाई", "Weighing (Tulai)"],
  katta: ["कट्टा / बोरी", "Bags (Bori)"],
  bardana: ["बारदाना", "Gunny bags (Bardana)"],
  katauti: ["कटौती", "Deduction (Katauti)"],
  kisan: ["किसान", "Kisan"],
  vyapari: ["व्यापारी", "Vyapari (Buyer)"],
  kisanParchi: ["किसान पर्ची", "Farmer sale voucher (Parchi)"],
  vyapariBill: ["व्यापारी बिल", "Buyer bill"],
  nakal: ["नकल", "Day book (Nakal)"],
  arhat: ["आढ़त / दामी", "Commission (Arhat)"],
  dhanka: ["धनका", "Dhanka"],
  palledari: ["पल्लेदारी / हम्माली", "Labour (Palledari)"],
  jharai: ["झराई", "Cleaning (Jharai)"],
  mandiShulk: ["मंडी शुल्क", "Market fee (Mandi shulk)"],
  kks: ["कृषक कल्याण शुल्क", "Farmer welfare fee"],
  khata: ["खाता", "Ledger (Khata)"],
  jama: ["जमा", "Credit (Jama)"],
  naam: ["नाम", "Debit (Naam)"],
  rokad: ["रोकड़", "Cash book (Rokad)"],
  peshgi: ["पेशगी", "Advance (Peshgi)"],
  byaj: ["ब्याज", "Interest (Byaj)"],
  bhugtan: ["भुगतान", "Payment"],
  hisab: ["हिसाब", "Settlement (Hisab)"],
  sarkari: ["सरकारी खरीद", "Govt procurement"],
  radd: ["रद्द", "Cancel (Radd)"],
  dinBand: ["दिन बंद", "Day close (Din band)"],
  rakam: ["रकम", "Amount (Rakam)"],
  kharcha: ["खर्चा", "Charge (Kharcha)"],
  gaon: ["गांव", "Village (Gaon)"],
  netWeight: ["शुद्ध वज़न", "Net weight"],
  grossWeight: ["कुल वज़न", "Gross weight"],
  nami: ["नमी", "Moisture (Nami)"],
  mitti: ["मिट्टी / धूल", "Dust (Mitti)"],
  tare: ["बोरी का वज़न", "Bag tare"],
  raseed: ["रसीद", "Receipt (Raseed)"],
  bank: ["बैंक", "Bank"],
  agency: ["एजेंसी", "Agency"],

  // menu (PRD §9 screen list)
  "menu.home": ["मुख्य पृष्ठ", "Home"],
  "menu.dheri": ["ढेरी एंट्री", "Dheri entry"],
  "menu.aamad": ["आमद", "Aamad"],
  "menu.boli": ["बोली", "Boli"],
  "menu.tulai": ["तुलाई", "Tulai"],
  "menu.parchi": ["पर्ची", "Parchi"],
  "menu.bill": ["बिल", "Bill"],
  "menu.jama": ["जमा", "Jama (receipt)"],
  "menu.naam": ["नाम", "Naam (payment)"],
  "menu.khata": ["खाता", "Khata"],
  "menu.rokad": ["रोकड़ / बैंक", "Rokad / Bank"],
  "menu.nakal": ["नकल / दिन बंद", "Nakal / Day close"],
  "menu.byaj": ["ब्याज", "Byaj"],
  "menu.report": ["रिपोर्ट", "Reports"],
  "menu.master": ["मास्टर", "Masters"],
  "menu.settings": ["सेटिंग", "Settings"],

  // common
  save: ["सेव", "Save"],
  savePrint: ["सेव + पर्ची प्रिंट", "Save + Print parchi"],
  print: ["प्रिंट", "Print"],
  search: ["खोजें", "Search"],
  date: ["तारीख़", "Date"],
  from: ["से", "From"],
  to: ["तक", "To"],
  total: ["कुल", "Total"],
  name: ["नाम (व्यक्ति)", "Name"],
  mobile: ["मोबाइल", "Mobile"],
  remarks: ["टिप्पणी", "Remarks"],
  reason: ["कारण", "Reason"],
  balance: ["बाकी", "Balance"],
  opening: ["शुरुआती बाकी", "Opening"],
  closing: ["अंतिम बाकी", "Closing"],
  status: ["स्थिति", "Status"],
  mode: ["तरीका", "Mode"],
  cash: ["नकद", "Cash"],
  cheque: ["चेक", "Cheque"],
  neft: ["NEFT / RTGS", "NEFT / RTGS"],
  upi: ["UPI", "UPI"],
  refNo: ["संदर्भ / UTR", "Reference / UTR"],
  narration: ["विवरण", "Narration"],
  logout: ["लॉग आउट", "Log out"],
  workingDate: ["कार्य तिथि", "Working date"],
  fy: ["वित्त वर्ष", "Financial year"],
  original: ["मूल", "Original"],
  duplicate: ["नकल", "Duplicate (Nakal)"],
  netPayable: ["शुद्ध देय", "Net payable"],
  billTotal: ["बिल कुल", "Bill total"],
  parchiNet: ["पर्ची नेट", "Parchi net"],
  signature: ["हस्ताक्षर", "Signature"],
  noData: ["कोई एंट्री नहीं", "No entries"],
} as const satisfies Record<string, readonly [string, string]>;

export type DictKey = keyof typeof DICT;
export type Lang = "hi" | "en";
export type Labels = Record<string, readonly [string, string]>;

export function makeT(lang: Lang, overrides: Record<string, { hi: string; en: string }> = {}) {
  return (key: DictKey | string): string => {
    const o = overrides[key];
    if (o) {
      const v = lang === "en" ? o.en : o.hi;
      if (v) return v;
    }
    const entry = (DICT as Labels)[key];
    if (!entry) return key;
    return lang === "en" ? entry[1] : entry[0];
  };
}

/** Pick inline text by language: tx("भाव डालें", "Enter bhav"). */
export const pick = (lang: Lang) => (hi: string, en: string) => (lang === "en" ? en : hi);

/** "तुलाई / Tulai" for bilingual prints. */
export function bilingual(key: string, overrides: Record<string, { hi: string; en: string }> = {}) {
  const hi = makeT("hi", overrides)(key);
  const en = makeT("en", overrides)(key);
  return hi === en ? hi : `${hi} / ${en}`;
}
