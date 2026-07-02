import { NextRequest, NextResponse } from "next/server";
import { q, one, TS } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const campaign = await one("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await q(
    `SELECT m.*, to_char(m.sent_at, '${TS}') AS sent_at,
      l.first_name, l.last_name, l.email, l.company, l.stage,
      CAST((SELECT COUNT(*) FROM replies r WHERE r.lead_id = l.id) AS INTEGER) AS reply_count
    FROM messages m JOIN leads l ON l.id = m.lead_id
    WHERE m.campaign_id = $1 ORDER BY m.sent_at DESC`,
    [id]
  );
  return NextResponse.json({ campaign, messages });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await q("UPDATE messages SET campaign_id = NULL WHERE campaign_id = $1", [id]);
  await q("DELETE FROM campaigns WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
