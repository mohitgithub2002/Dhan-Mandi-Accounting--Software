import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isIsoDate, todayIST } from "@/lib/dates";
import { can, type Permission, type Role } from "@/lib/permissions";
import { cookieOptions, SESSION_COOKIE, signSession, verifySession, WORKING_DATE_COOKIE } from "@/lib/session";
import { audit, type Actor } from "./core";
import { fail } from "./errors";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const getSession = cache(async () => {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
});

/** The signed-in, active user (fresh from the DB so role changes apply at once). */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const s = await getSession();
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.uid));
  if (!u || !u.active) return null;
  return { id: u.id, role: u.role as Role, name: u.name, lang: u.lang };
});

/** For server actions: throws a user-facing error if not allowed. */
export async function requireActor(perm?: Permission): Promise<Actor> {
  const a = await currentActor();
  if (!a) fail("दोबारा लॉगिन करें", "Please log in again");
  if (perm && !can(a!.role, perm)) fail("आपको इसकी अनुमति नहीं है", "You are not allowed to do this");
  return a!;
}

/** For pages: redirect to login, or show the no-permission page. */
export async function requirePage(perm?: Permission): Promise<Actor> {
  const a = await currentActor();
  if (!a) redirect("/login");
  if (perm && !can(a.role, perm)) redirect("/?denied=1");
  return a;
}

/** Working date: munim/malik may back-date (PRD §9 rule 10); others always work today. */
export async function workingDate(actor: Actor): Promise<string> {
  if (!can(actor.role, "back_date")) return todayIST();
  const jar = await cookies();
  const v = jar.get(WORKING_DATE_COOKIE)?.value;
  return isIsoDate(v) ? v : todayIST();
}

/** Mobile + password login with lock after 5 wrong attempts (PRD §11). */
export async function login(mobile: string, password: string) {
  const [u] = await db.select().from(users).where(eq(users.mobile, mobile.trim()));
  if (!u || !u.active) fail("मोबाइल या पासवर्ड ग़लत है", "Wrong mobile or password");
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    fail(`खाता ${LOCK_MINUTES} मिनट के लिए बंद है। बाद में कोशिश करें।`, `Account locked for ${LOCK_MINUTES} minutes. Try later.`);
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) {
    const attempts = u.failedAttempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await db
      .update(users)
      .set({ failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null })
      .where(eq(users.id, u.id));
    if (lock) await audit(db, null, { table: "users", rowId: u.id, action: "locked" });
    fail("मोबाइल या पासवर्ड ग़लत है", "Wrong mobile or password");
  }
  await db.update(users).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, u.id));
  await audit(db, { id: u.id, role: u.role as Role, name: u.name, lang: u.lang }, { table: "users", rowId: u.id, action: "login" });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: u.id, role: u.role as Role, name: u.name, lang: u.lang === "en" ? "en" : "hi" }), cookieOptions);
  return u;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKING_DATE_COOKIE);
}

export async function refreshSessionCookie(actor: Actor) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: actor.id, role: actor.role, name: actor.name, lang: actor.lang === "en" ? "en" : "hi" }), cookieOptions);
}
