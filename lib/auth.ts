import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type BinaryLike,
} from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { one, q } from "./db";
import { SESSION_COOKIE } from "./constants";

const scrypt = promisify(scryptCb) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number
) => Promise<Buffer>;

const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

// ── Passwords ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = (stored ?? "").split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ── Sessions ─────────────────────────────────────────────────────────
// The cookie holds a random token; only its SHA-256 is stored, so a leaked
// database dump can't be replayed as a session.

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    tokenHash(token),
    userId,
    expires.toISOString(),
  ]);
  await q("DELETE FROM sessions WHERE expires_at < now()");
  return { token, expires };
}

export async function destroyCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await q("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

export async function destroyAllSessions(userId: number): Promise<void> {
  await q("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

/** The signed-in user for the current request, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<SessionUser>(
    `SELECT u.id, u.email, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)]
  );
}

/** Standard 401 for API routes. The proxy redirects pages; this covers
 *  requests whose cookie exists but no longer matches a live session. */
export function authRequired(): NextResponse {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

// ── Cookies ──────────────────────────────────────────────────────────

/** Secure flag follows the request protocol so localhost (http) still works. */
function isHttps(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
  );
}

export function setSessionCookie(
  res: NextResponse,
  req: NextRequest,
  token: string,
  expires: Date
): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    expires,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
