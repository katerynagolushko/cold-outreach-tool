import { NextRequest, NextResponse } from "next/server";
import { one, addActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lead = await one("SELECT id FROM leads WHERE id = $1", [id]);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { note } = await req.json();
  const text = String(note ?? "").trim();
  if (!text) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
  await addActivity(Number(id), "note", text);
  return NextResponse.json({ ok: true });
}
