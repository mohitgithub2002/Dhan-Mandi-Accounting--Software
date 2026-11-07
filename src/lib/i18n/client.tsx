"use client";
import { createContext, useContext, useMemo } from "react";
import { makeT, pick, type Lang } from "./dict";
import type { Role } from "@/lib/permissions";
import { can, type Permission } from "@/lib/permissions";

interface Ctx {
  lang: Lang;
  overrides: Record<string, { hi: string; en: string }>;
  role: Role | null;
  workingDate: string;
}

const I18nCtx = createContext<Ctx>({ lang: "hi", overrides: {}, role: null, workingDate: "" });

export function AppProvider({ children, ...value }: Ctx & { children: React.ReactNode }) {
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

/** t(key) for shabdavali words, tx(hi, en) for one-off text. */
export function useI18n() {
  const c = useContext(I18nCtx);
  return useMemo(
    () => ({
      lang: c.lang,
      t: makeT(c.lang, c.overrides),
      tx: pick(c.lang),
      role: c.role,
      can: (p: Permission) => can(c.role, p),
      workingDate: c.workingDate,
    }),
    [c],
  );
}
