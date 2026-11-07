/** Edge-safe session token helpers (used by middleware and server code). */
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "./permissions";

export const SESSION_COOKIE = "mk_session";
export const WORKING_DATE_COOKIE = "mk_wd";
/** PRD §11: session timeout after 30 minutes idle (sliding, refreshed on every request). */
export const IDLE_MINUTES = 30;

export interface SessionPayload {
  uid: number;
  role: Role;
  name: string;
  lang: "hi" | "en";
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (at least 16 characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { uid: Number(payload.uid), role: payload.role as Role, name: String(payload.name), lang: payload.lang === "en" ? "en" : "hi" };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.COOKIE_SECURE === "1",
  maxAge: IDLE_MINUTES * 60,
};
