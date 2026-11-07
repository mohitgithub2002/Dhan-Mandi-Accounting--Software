"use client";
import { useEffect, useId, useRef, useState } from "react";
import { quickAddParty, searchParties, type PartyHit } from "@/actions/common";
import { useI18n } from "@/lib/i18n/client";
import { Button, Field, Input, inputCls, Notice, cx } from "./ui";
import { focusNext } from "./KeyForm";

export type { PartyHit };

export function partyLabel(p: PartyHit | null | undefined, lang: "hi" | "en") {
  if (!p) return "";
  const name = lang === "en" ? p.nameEn || p.nameHi : p.nameHi || p.nameEn;
  return `${name}${p.village ? ` (${p.village})` : ""} #${p.id}`;
}

/**
 * Party picker with type-ahead (F2). Enter picks the highlighted party and moves
 * to the next field. Optional quick-add for a new kisan / vyapari.
 */
export function PartySearch({
  types,
  value,
  onChange,
  autoFocus,
  quickAdd,
  placeholder,
  id,
}: {
  types: string[];
  value: PartyHit | null;
  onChange: (p: PartyHit | null) => void;
  autoFocus?: boolean;
  quickAdd?: "kisan" | "vyapari";
  placeholder?: string;
  id?: string;
}) {
  const { lang, tx } = useI18n();
  const [q, setQ] = useState(partyLabel(value, lang));
  const [hits, setHits] = useState<PartyHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const seq = useRef(0);

  useEffect(() => {
    setQ(partyLabel(value, lang));
  }, [value, lang]);

  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    const h = setTimeout(async () => {
      const term = value && q === partyLabel(value, lang) ? "" : q;
      const r = await searchParties(term, types);
      if (my === seq.current) {
        setHits(r);
        setActive(0);
      }
    }, 120);
    return () => clearTimeout(h);
  }, [q, open, types, value, lang]);

  function pick(p: PartyHit) {
    onChange(p);
    setQ(partyLabel(p, lang));
    setOpen(false);
    focusNext(inputRef.current);
  }

  const showAdd = !!quickAdd;
  const count = hits.length + (showAdd ? 1 : 0);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        data-party-search
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder ?? tx("नाम / गांव / मोबाइल (F2)", "Name / village / mobile (F2)")}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={(e) => {
          e.currentTarget.select();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, count - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && count > 0 && !(value && q === partyLabel(value, lang))) {
            e.preventDefault();
            if (active < hits.length) pick(hits[active]);
            else setAdding(true);
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open && count > 0 ? (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-lg">
          {hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
              className={cx("cursor-pointer px-3 py-2", i === active ? "bg-amber-100" : "hover:bg-slate-50")}
            >
              <div className="font-medium">
                {h.nameHi || h.nameEn} {h.nameHi && h.nameEn ? <span className="text-slate-500">/ {h.nameEn}</span> : null}
                <span className="ml-2 text-sm text-slate-400">#{h.id}</span>
              </div>
              <div className="text-sm text-slate-600">
                {[h.fatherName && `${tx("पिता", "s/o")} ${h.fatherName}`, h.village, h.mobile].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
          {showAdd ? (
            <li
              role="option"
              aria-selected={active === hits.length}
              onMouseDown={(e) => {
                e.preventDefault();
                setAdding(true);
              }}
              className={cx("cursor-pointer border-t px-3 py-2 font-medium text-brand-700", active === hits.length ? "bg-amber-100" : "hover:bg-slate-50")}
            >
              + {quickAdd === "kisan" ? tx("नया किसान जोड़ें", "Add new kisan") : tx("नया व्यापारी जोड़ें", "Add new vyapari")}
            </li>
          ) : null}
        </ul>
      ) : null}
      {adding && quickAdd ? (
        <QuickAdd
          partyType={quickAdd}
          initialName={value ? "" : q}
          onClose={() => {
            setAdding(false);
            inputRef.current?.focus();
          }}
          onAdded={(p) => {
            setAdding(false);
            pick(p);
          }}
        />
      ) : null}
    </div>
  );
}

function QuickAdd({
  partyType,
  initialName,
  onClose,
  onAdded,
}: {
  partyType: "kisan" | "vyapari";
  initialName: string;
  onClose: () => void;
  onAdded: (p: PartyHit) => void;
}) {
  const { tx } = useI18n();
  const [name, setName] = useState(initialName);
  const [village, setVillage] = useState("");
  const [mobile, setMobile] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await quickAddParty({ partyType, name, village, mobile });
    setBusy(false);
    if (r.ok) onAdded(r.data);
    else setErr(r.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" data-own-keys>
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const t = e.target as HTMLElement;
            const order = ["qa-name", "qa-village", "qa-mobile"];
            const i = order.indexOf(t.id);
            if (i === order.length - 1) void save();
            else if (i >= 0) document.getElementById(order[i + 1])?.focus();
          }
        }}
      >
        <h3 className="mb-3 text-lg font-semibold">
          {partyType === "kisan" ? tx("नया किसान", "New kisan") : tx("नया व्यापारी", "New vyapari")}
        </h3>
        <div className="flex flex-col gap-3">
          <Field label={tx("नाम", "Name")}>
            <input id="qa-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={tx("गांव", "Village")}>
            <input id="qa-village" className={inputCls} value={village} onChange={(e) => setVillage(e.target.value)} />
          </Field>
          <Field label={tx("मोबाइल", "Mobile")}>
            <input id="qa-mobile" className={inputCls} inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
          {err ? <Notice kind="error">{err}</Notice> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {tx("वापस (Esc)", "Back (Esc)")}
            </Button>
            <Button disabled={busy} onClick={save}>
              {tx("जोड़ें", "Add")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
