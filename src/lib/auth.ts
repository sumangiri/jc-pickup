import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, one, uid } from "./db";

const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me-please-32chars");

export type Session = { id: string; username: string; role: string };

export async function createSession(user: Session) {
  const token = await new SignJWT(user as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  cookies().set("jcp_session", token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<Session | null> {
  const c = cookies().get("jcp_session")?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return { id: payload.id as string, username: payload.username as string, role: payload.role as string };
  } catch { return null; }
}

export function clearSession() { cookies().delete("jcp_session"); }

export async function register(username: string, password: string) {
  const exists = await one("SELECT id FROM users WHERE username = ?", [username.toLowerCase()]);
  if (exists) throw new Error("That username is taken.");
  const id = uid();
  const hash = await bcrypt.hash(password, 10);
  await query("INSERT INTO users (id, username, password, role) VALUES (?,?,?,?)",
    [id, username.toLowerCase(), hash, "member"]);
  return { id, username: username.toLowerCase(), role: "member" };
}

export async function login(username: string, password: string) {
  const u = await one<any>("SELECT * FROM users WHERE username = ?", [username.toLowerCase()]);
  if (!u) throw new Error("No account with that username.");
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) throw new Error("Wrong password.");
  return { id: u.id, username: u.username, role: u.role };
}

export function isAdmin(s: Session | null) { return s?.role === "admin" || s?.role === "superadmin"; }
export function isSuper(s: Session | null) { return s?.role === "superadmin"; }
