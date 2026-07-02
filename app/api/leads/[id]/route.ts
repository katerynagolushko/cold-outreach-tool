import { NextRequest, NextResponse } from "next/server";
import { getDb, setStage, STAGES, type Stage } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = db
    .prepare("SELECT * FROM messages WHERE lead_id = ? ORDER BY sent_at DESC")
    .all(id);
  const replies = db
    .prepare("SELECT * FROM replies WHERE lead_id = ? ORDER BY received_at DESC")
    .all(id);
  const activities = db
    .prepare("SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC, id DESC")
    .all(id);
  return NextResponse.json({ lead, messages, replies, activities });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const body = await req.json();
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.stage) {
    if (!STAGES.includes(body.stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    setStage(db, Number(id), body.stage as Stage);
  }
  for (const field of ["first_name", "last_name", "role", "company", "city"] as const) {
    if (typeof body[field] === "string") {
      db.prepare(`UPDATE leads SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(
        body[field].trim(),
        id
      );
    }
  }
  return NextResponse.json({ lead: db.prepare("SELECT * FROM leads WHERE id = ?").get(id) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("DELETE FROM activities WHERE lead_id = ?").run(id);
  db.prepare("DELETE FROM replies WHERE lead_id = ?").run(id);
  db.prepare("DELETE FROM messages WHERE lead_id = ?").run(id);
  db.prepare("DELETE FROM leads WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
