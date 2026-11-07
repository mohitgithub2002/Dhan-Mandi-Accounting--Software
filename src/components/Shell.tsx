"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { logoutAction, setLang, setWorkingDate } from "@/actions/common";
import { useI18n } from "@/lib/i18n/client";
import type { Permission } from "@/lib/permissions";
import { cx } from "./ui";

const MENU: { href: string; key: string; perm?: Permission; hint?: string }[] = [
  { href: "/", key: "menu.home" },
  { href: "/dheri", key: "menu.dheri", perm: "entry", hint: "Alt+N" },
  { href: "/aamad", key: "menu.aamad", perm: "entry" },
  { href: "/boli", key: "menu.boli", perm: "entry" },
  { href: "/tulai", key: "menu.tulai", perm: "entry" },
  { href: "/parchi", key: "menu.parchi", perm: "reports_own" },
  { href: "/bill", key: "menu.bill", perm: "reports_own" },
  { href: "/jama", key: "menu.jama", perm: "jama_naam" },
  { href: "/naam", key: "menu.naam", perm: "jama_naam" },
  { href: "/khata", key: "menu.khata", perm: "reports" },
  { href: "/rokad", key: "menu.rokad", perm: "reports" },
  { href: "/nakal", key: "menu.nakal", perm: "reports" },
  { href: "/byaj", key: "menu.byaj", perm: "byaj" },
  { href: "/report", key: "menu.report", perm: "reports_own" },
  { href: "/master", key: "menu.master", perm: "reports" },
  { href: "/settings", key: "menu.settings", perm: "admin" },
];

const ROLE_LABEL: Record<string, [string, string]> = {
  malik: ["मालिक", "Malik"],
  munim: ["मुनीम", "Munim"],
  operator: ["ऑपरेटर", "Operator"],
  ca: ["सीए", "CA"],
};

export function Shell({
  children,
  firmName,
  userName,
  role,
  fyLabel,
  dayClosed,
}: {
  children: React.ReactNode;
  firmName: string;
  userName: string;
  role: string;
  fyLabel: string;
  dayClosed: boolean;
}) {
  const { t, lang, can, workingDate } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  // Global shortcuts (PRD §9 rule 4): Alt+N new dheri, F2 party search, F3 jins, Esc back.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/dheri");
      } else if (e.key === "F2") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-party-search]")?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        document.querySelector<HTMLElement>("[data-jins]")?.focus();
      } else if (e.key === "Escape") {
        const a = document.activeElement;
        if (!a || a === document.body) router.back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const items = MENU.filter((m) => !m.perm || can(m.perm));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-brand-800 bg-brand-700 px-4 py-2 text-white">
        <Link href="/" className="text-lg font-bold">
          {firmName || "मंडी खाता"}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-90">{t("workingDate")}:</span>
          {can("back_date") ? (
            <input
              type="date"
              aria-label={t("workingDate")}
              value={workingDate}
              onChange={(e) =>
                start(async () => {
                  await setWorkingDate(e.target.value);
                  router.refresh();
                })
              }
              className="rounded bg-white px-2 py-1 text-slate-900"
            />
          ) : (
            <span className="font-semibold">{workingDate.split("-").reverse().join("-")}</span>
          )}
          {dayClosed ? <span className="rounded bg-red-600 px-2 py-0.5 text-sm">{t("dinBand")}</span> : null}
        </div>
        <span className="text-sm">
          {t("fy")}: <b>{fyLabel}</b>
        </span>
        <span className="ml-auto text-sm">
          {userName} · {ROLE_LABEL[role]?.[lang === "en" ? 1 : 0] ?? role}
        </span>
        <button
          type="button"
          className="rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
          onClick={() =>
            start(async () => {
              await setLang(lang === "en" ? "hi" : "en");
              router.refresh();
            })
          }
        >
          {lang === "en" ? "हिंदी" : "English"}
        </button>
        <form action={logoutAction}>
          <button type="submit" className="rounded border border-white/40 px-3 py-1 text-sm hover:bg-white/10">
            {t("logout")}
          </button>
        </form>
      </header>
      <div className="flex flex-1">
        <nav className="no-print w-52 shrink-0 border-r border-slate-200 bg-white" aria-label="menu">
          <ul className="py-2">
            {items.map((m) => {
              const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
              return (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className={cx(
                      "flex items-center justify-between px-4 py-2.5 text-base",
                      active ? "bg-brand-100 font-semibold text-brand-800" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span>{t(m.key)}</span>
                    {m.hint ? <span className="text-xs text-slate-400">{m.hint}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className={cx("min-w-0 flex-1 p-4 md:p-6", pending && "opacity-60")}>{children}</main>
      </div>
    </div>
  );
}
