export const BASIS_LABEL: Record<string, [string, string]> = {
  pct_amount: ["रकम का %", "% of rakam"],
  per_qtl: ["₹ प्रति क्विंटल", "₹ per quintal"],
  per_bag: ["₹ प्रति बोरी", "₹ per bag"],
  fixed_doc: ["₹ हर पर्ची/बिल", "₹ fixed per parchi/bill"],
  pct_of_line: ["दूसरे खर्चे का %", "% of another line"],
};
export const PAYER_LABEL: Record<string, [string, string]> = {
  kisan: ["किसान (पर्ची में घटे)", "Kisan (deducted on parchi)"],
  vyapari: ["व्यापारी (बिल में जुड़े)", "Vyapari (added on bill)"],
  split: ["बंटा हुआ", "Split"],
};
export const POST_LABEL: Record<string, [string, string]> = {
  income: ["आमदनी खाता", "Income account"],
  payable: ["देय खाता", "Payable account"],
  show: ["केवल छपे (पोस्ट नहीं)", "Show only (not posted)"],
};
export const KIND_LABEL: Record<string, [string, string]> = {
  kharcha: ["खर्चा", "Kharcha (charge)"],
  shulk: ["शुल्क / टैक्स", "Shulk / tax"],
  katauti: ["कटौती (रकम)", "Katauti (value cut)"],
  gst: ["GST", "GST"],
};
export const ROUND_LABEL: Record<string, [string, string]> = {
  none: ["पैसे तक", "To the paisa"],
  nearest_1: ["नज़दीकी ₹1", "Nearest ₹1"],
  nearest_0_10: ["नज़दीकी 10 पैसे", "Nearest 10 paise"],
  up_1: ["ऊपर ₹1", "Up to ₹1"],
};
