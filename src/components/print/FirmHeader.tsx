import type { FirmSettings } from "@/lib/server/core";
import type { PrintLang } from "@/lib/server/printdata";

/** Firm name, licence, address, phone on every print (PRD §8). */
export function FirmHeader({ firm, lang, title, mark }: { firm: FirmSettings; lang: PrintLang; title: string; mark?: string }) {
  const name = lang === "en" ? firm.nameEn || firm.nameHi : firm.nameHi || firm.nameEn;
  const addr = lang === "en" ? firm.addressEn || firm.addressHi : firm.addressHi || firm.addressEn;
  return (
    <header style={{ borderBottom: "2px solid #000", paddingBottom: 6, marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
      {firm.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={firm.logo} alt="" style={{ height: 56, width: 56, objectFit: "contain" }} />
      ) : null}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "18pt", fontWeight: 700, lineHeight: 1.2 }}>{name}</div>
        {lang === "both" && firm.nameEn && firm.nameHi ? <div style={{ fontWeight: 600 }}>{firm.nameEn}</div> : null}
        <div>{addr}</div>
        <div style={{ fontSize: "9.5pt" }}>
          {firm.licenceNo ? `लाइसेंस / Licence: ${firm.licenceNo}` : ""}
          {firm.phone ? ` · ☎ ${firm.phone}` : ""}
          {firm.pan ? ` · PAN ${firm.pan}` : ""}
          {firm.gstin ? ` · GSTIN ${firm.gstin}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "14pt", fontWeight: 700 }}>{title}</div>
        {mark ? <div style={{ border: "2px solid #000", padding: "1px 8px", fontWeight: 700, marginTop: 4, display: "inline-block" }}>{mark}</div> : null}
      </div>
    </header>
  );
}

export function SignatureLine({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
      <div style={{ borderTop: "1px solid #000", paddingTop: 2, minWidth: 180, textAlign: "center" }}>{left}</div>
      <div style={{ borderTop: "1px solid #000", paddingTop: 2, minWidth: 180, textAlign: "center" }}>{right}</div>
    </div>
  );
}
