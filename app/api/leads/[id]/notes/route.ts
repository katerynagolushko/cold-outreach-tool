import { NextRequest, NextResponse } from "next/server";
import { getDb, addActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { note } = await req.json();
  const text = String(note ?? "").trim();
  if (!text) return NextResponse.json({ error: "Note is empty" }, { status: 400 });
  addActivity(db, Number(id), "note", text);
  return NextResponse.json({ ok: true });
}
