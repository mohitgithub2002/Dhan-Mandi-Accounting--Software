"use client";
import { useI18n } from "@/lib/i18n/client";
import { Badge } from "./ui";

const MAP: Record<string, { tone: "slate" | "amber" | "blue" | "green" | "red"; hi: string; en: string }> = {
  aamad: { tone: "amber", hi: "बोली बाकी", en: "Pending boli" },
  boli: { tone: "blue", hi: "तुलाई बाकी", en: "Pending tulai" },
  tulai: { tone: "slate", hi: "पर्ची बाकी", en: "Pending parchi" },
  parchi: { tone: "green", hi: "पर्ची बनी", en: "Parchi made" },
  active: { tone: "green", hi: "चालू", en: "Active" },
  radd: { tone: "red", hi: "रद्द", en: "Cancelled" },
};

export function StatusBadge({ status }: { status: string }) {
  const { lang } = useI18n();
  const m = MAP[status] ?? { tone: "slate" as const, hi: status, en: status };
  return <Badge tone={m.tone}>{lang === "en" ? m.en : m.hi}</Badge>;
}
