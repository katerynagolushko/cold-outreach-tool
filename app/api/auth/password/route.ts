import { NextRequest, NextResponse } from "next/server";
import { one, q } from "@/lib/db";
import {
  authRequired,
  createSession,
  currentUser,
  destroyAllSessions,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Change the signed-in user's password. Signs out every other device. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return authRequired();

  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (next.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const row = await one<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [user.id]
  );
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  await q("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(next), user.id]);
  await destroyAllSessions(user.id);
  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, req, token, expires);
  return res;
}
