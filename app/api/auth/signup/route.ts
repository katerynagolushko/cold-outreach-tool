import { NextRequest, NextResponse } from "next/server";
import { one, q } from "@/lib/db";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Create a profile. When APP_PASSWORD is set it doubles as an invite code,
 * so only people you share it with can register on a hosted deployment.
 * The first profile ever created adopts any data from before profiles
 * existed (rows with no owner), so an upgraded single-user install keeps
 * its leads and campaigns.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const invite = String(body.invite ?? "");

  if (!name) return bad("Please enter your name.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Please enter a valid email address.");
  if (password.length < 8) return bad("Password must be at least 8 characters.");

  const required = process.env.APP_PASSWORD;
  if (required && invite !== required) {
    return bad("Invite code is missing or incorrect.", 403);
  }

  let user: { id: number };
  try {
    const rows = await q<{ id: number }>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, name, await hashPassword(password)]
    );
    user = rows[0];
  } catch (e) {
    if (/unique|duplicate/i.test((e as Error).message)) {
      return bad("An account with this email already exists — sign in instead.", 409);
    }
    throw e;
  }

  const count = await one<{ c: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS c FROM users");
  if (count?.c === 1) {
    await q("UPDATE leads SET user_id = $1 WHERE user_id IS NULL", [user.id]);
    await q("UPDATE campaigns SET user_id = $1 WHERE user_id IS NULL", [user.id]);
  }

  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({ user: { id: user.id, email, name } });
  setSessionCookie(res, req, token, expires);
  return res;
}
