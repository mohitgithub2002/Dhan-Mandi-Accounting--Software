"use client";
import { useEffect, useRef, type ComponentProps, type KeyboardEvent } from "react";

const FOCUSABLE = "input:not([type=hidden]):not([disabled]):not([data-skip]), select:not([disabled]):not([data-skip]), textarea:not([disabled]):not([data-skip]), button[data-enter]:not([disabled])";

/**
 * Keyboard-fast form (PRD §9 rule 4): Enter moves to the next field (and submits
 * from the last), Esc moves back, Ctrl+S saves, Ctrl+P runs `onPrint`.
 * Warns before leaving with unsaved changes (rule 9).
 */
export function KeyForm({
  onPrint,
  dirty,
  onKeyDown,
  ...p
}: ComponentProps<"form"> & { onPrint?: () => void; dirty?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function handle(e: KeyboardEvent<HTMLFormElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const form = ref.current;
    if (!form) return;
    const target = e.target as HTMLElement;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      form.requestSubmit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && onPrint) {
      e.preventDefault();
      onPrint();
      return;
    }
    if (target.closest("[data-own-keys]")) return;
    const fields = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const i = fields.indexOf(target);
    if (i < 0) return;
    if (e.key === "Enter" && target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON") {
      e.preventDefault();
      const next = fields[i + 1];
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) next.select();
      } else form.requestSubmit();
    } else if (e.key === "Escape") {
      const prev = fields[i - 1];
      if (prev) {
        e.preventDefault();
        prev.focus();
      }
    }
  }

  return <form ref={ref} onKeyDown={handle} {...p} />;
}

/** Move focus to the next field of the element's form (used after picking from a list). */
export function focusNext(el: HTMLElement | null) {
  const form = el?.closest("form");
  if (!form || !el) return;
  const fields = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
  const i = fields.indexOf(el);
  const next = fields[i + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
}
