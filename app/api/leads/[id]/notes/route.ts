import { NextRequest, NextResponse } from "next/server";
import { one, addActivity } from "@/lib/db";
import { authRequired, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return authRequired();

  const { id } = await ctx.params;
  const lead = await one("SELECT id FROM leads WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { note } = await req.json();
  const text = String(note ?? "").trim();
  if (!text) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
  await addActivity(Number(id), "note", text);
  return NextResponse.json({ ok: true });
}
