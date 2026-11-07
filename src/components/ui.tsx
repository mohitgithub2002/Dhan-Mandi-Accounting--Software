import type { ComponentProps, ReactNode } from "react";
import { formatINR, sideOf, type Num } from "@/lib/calc";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 border-brand-800",
  secondary: "bg-white text-slate-800 hover:bg-slate-50 border-slate-300",
  danger: "bg-red-700 text-white hover:bg-red-800 border-red-800",
  success: "bg-green-700 text-white hover:bg-green-800 border-green-800",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border-transparent",
};

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-base font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ variant = "secondary", className, ...p }: ComponentProps<"a"> & { variant?: Variant }) {
  return (
    <a
      {...p}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-base font-medium shadow-sm",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export const inputCls =
  "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cx(inputCls, className)} />;
}

export function NumInput({ className, ...p }: ComponentProps<"input">) {
  return <input inputMode="decimal" autoComplete="off" {...p} className={cx(inputCls, "num", className)} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cx(inputCls, className)} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(inputCls, className)} />;
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="text-sm text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-lg font-semibold text-slate-800">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-900",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={cx("inline-block rounded px-2 py-0.5 text-sm font-medium", tones[tone])}>{children}</span>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "warn" | "ok"; children: ReactNode }) {
  const k = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    error: "border-red-300 bg-red-50 text-red-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    ok: "border-green-300 bg-green-50 text-green-900",
  };
  return <div role={kind === "error" ? "alert" : "status"} className={cx("rounded-md border px-3 py-2", k[kind])}>{children}</div>;
}

/** Money with Indian grouping. */
export function Money({ value, className }: { value: Num | null | undefined; className?: string }) {
  return <span className={cx("num", className)}>{formatINR(value ?? 0)}</span>;
}

/** Balance always shows its side: jama in green, naam in red (PRD §9 rule 6). */
export function Balance({ value, lang }: { value: Num; lang: "hi" | "en" }) {
  const side = sideOf(value);
  const abs = formatINR(String(value).startsWith("-") ? String(value).slice(1) : value);
  if (!side) return <span className="num">0.00</span>;
  return (
    <span className={cx("num font-semibold", side === "jama" ? "text-jama" : "text-naam")}>
      {abs} {side === "jama" ? (lang === "en" ? "Jama" : "जमा") : lang === "en" ? "Naam" : "नाम"}
    </span>
  );
}

export const tableCls = "w-full border-collapse text-base";
export const thCls = "border-b-2 border-slate-300 bg-slate-50 px-2 py-2 text-left text-sm font-semibold text-slate-700";
export const tdCls = "border-b border-slate-200 px-2 py-1.5 align-top";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx(tableCls, className)}>{children}</table>
    </div>
  );
}
