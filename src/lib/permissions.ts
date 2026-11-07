/** Role → permission matrix (PRD §2). Shared by server checks and UI hiding. */
export type Role = "malik" | "munim" | "operator" | "ca";
export const ROLES: Role[] = ["malik", "munim", "operator", "ca"];

export type Permission =
  | "entry" // aamad, boli, tulai, make parchi / bill
  | "print"
  | "edit_printed" // edit a printed parchi or bill (munim with reason)
  | "radd" // cancel a parchi, bill or voucher
  | "jama_naam"
  | "rate_master"
  | "byaj"
  | "day_close"
  | "day_reopen"
  | "reports" // full reports
  | "reports_own" // operator: own day's list
  | "party_edit"
  | "party_quick_add"
  | "jins_master"
  | "admin" // users, backup, settings, labels
  | "back_date"; // change working date

const MATRIX: Record<Permission, Role[]> = {
  entry: ["malik", "munim", "operator"],
  print: ["malik", "munim", "operator"],
  edit_printed: ["malik", "munim"],
  radd: ["malik"],
  jama_naam: ["malik", "munim"],
  rate_master: ["malik"],
  byaj: ["malik", "munim"],
  day_close: ["malik", "munim"],
  day_reopen: ["malik"],
  reports: ["malik", "munim", "ca"],
  reports_own: ["malik", "munim", "operator", "ca"],
  party_edit: ["malik", "munim"],
  party_quick_add: ["malik", "munim", "operator"],
  jins_master: ["malik"],
  admin: ["malik"],
  back_date: ["malik", "munim"],
};

export function can(role: Role | string | undefined | null, p: Permission): boolean {
  return !!role && (MATRIX[p] as string[]).includes(role);
}
