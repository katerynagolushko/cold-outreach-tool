import { NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroyCurrentSession();
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
