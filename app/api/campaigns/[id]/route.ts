import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = db
    .prepare(
      `SELECT m.*, l.first_name, l.last_name, l.email, l.company, l.stage,
        (SELECT COUNT(*) FROM replies r WHERE r.lead_id = l.id) AS reply_count
      FROM messages m JOIN leads l ON l.id = m.lead_id
      WHERE m.campaign_id = ? ORDER BY m.sent_at DESC`
    )
    .all(id);
  return NextResponse.json({ campaign, messages });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("UPDATE messages SET campaign_id = NULL WHERE campaign_id = ?").run(id);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
