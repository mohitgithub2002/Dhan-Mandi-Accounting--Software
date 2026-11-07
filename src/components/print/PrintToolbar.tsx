"use client";
import { useEffect, useRef, useState } from "react";
import { markPrintedAction } from "@/actions/entry";

/**
 * Print bar: marks the document printed (first print = Original, later = Nakal)
 * then opens the browser print dialog (Save as PDF works on any printer).
 */
export function PrintToolbar({
  doc,
  auto,
  langLinks,
  extra,
}: {
  doc?: { docType: "parchi" | "bill" | "voucher"; id: number };
  auto?: boolean;
  langLinks?: { label: string; href: string; active: boolean }[];
  extra?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  async function go() {
    setBusy(true);
    if (doc) await markPrintedAction(doc);
    setBusy(false);
    window.print();
  }

  useEffect(() => {
    if (auto && !fired.current) {
      fired.current = true;
      setTimeout(() => void go(), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        void go();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="toolbar sticky top-0 z-10 mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center gap-2 rounded-md bg-slate-800 p-2 text-white">
      <button type="button" onClick={go} disabled={busy} className="rounded bg-amber-500 px-4 py-2 font-semibold text-black">
        प्रिंट / Print (Ctrl+P)
      </button>
      {langLinks?.map((l) => (
        <a key={l.href} href={l.href} className={`rounded px-3 py-2 ${l.active ? "bg-white text-black" : "bg-slate-700"}`}>
          {l.label}
        </a>
      ))}
      {extra}
      <button type="button" onClick={() => window.close()} className="ml-auto rounded bg-slate-600 px-3 py-2">
        बंद / Close
      </button>
    </div>
  );
}
