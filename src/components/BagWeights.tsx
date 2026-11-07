"use client";
import { useRef } from "react";
import { formatINR } from "@/lib/calc";
import { useI18n } from "@/lib/i18n/client";
import { focusNext } from "./KeyForm";
import { inputCls, cx } from "./ui";

/** Bag-wise tulai: each bag's weight, Enter adds the next bag; Enter on an empty bag moves on (PRD §5.4). */
export function BagWeights({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { tx } = useI18n();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const list = value.length ? value : [""];
  const total = list.reduce((a, v) => a + (Number(v) || 0), 0);
  const filled = list.filter((v) => Number(v) > 0).length;

  return (
    <div data-own-keys className="rounded-md border border-slate-300 p-2">
      <div className="mb-1 flex justify-between text-sm text-slate-600">
        <span>{tx("बोरी अनुसार वज़न (kg)", "Bag-wise weights (kg)")}</span>
        <span className="num">
          {filled} {tx("बोरी", "bags")} · {formatINR(total)} kg
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 md:grid-cols-8">
        {list.map((v, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`${tx("बोरी", "Bag")} ${i + 1}`}
            inputMode="decimal"
            value={v}
            placeholder={String(i + 1)}
            className={cx(inputCls, "num min-h-9 px-2 py-1")}
            onChange={(e) => {
              const next = [...list];
              next[i] = e.target.value;
              onChange(next);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (!v.trim()) {
                onChange(list.filter((x, j) => j !== i || x.trim()));
                focusNext(refs.current[refs.current.length - 1] ?? e.currentTarget);
                return;
              }
              if (i === list.length - 1) {
                onChange([...list, ""]);
                setTimeout(() => refs.current[i + 1]?.focus(), 0);
              } else refs.current[i + 1]?.focus();
            }}
          />
        ))}
      </div>
    </div>
  );
}
