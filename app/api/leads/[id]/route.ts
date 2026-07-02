import { NextRequest, NextResponse } from "next/server";
import { q, one, setStage, STAGES, TS, type Stage } from "@/lib/db";
import { authRequired, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return authRequired();

  const { id } = await ctx.params;
  const lead = await one(
    `SELECT *, to_char(created_at, '${TS}') AS created_at FROM leads WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  );
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await q(
    `SELECT *, to_char(sent_at, '${TS}') AS sent_at FROM messages WHERE lead_id = $1 ORDER BY messages.sent_at DESC`,
    [id]
  );
  const replies = await q(
    `SELECT *, to_char(received_at, '${TS}') AS received_at FROM replies WHERE lead_id = $1 ORDER BY replies.received_at DESC`,
    [id]
  );
  const activities = await q(
    `SELECT *, to_char(created_at, '${TS}') AS created_at FROM activities WHERE lead_id = $1 ORDER BY activities.created_at DESC, id DESC`,
    [id]
  );
  return NextResponse.json({ lead, messages, replies, activities });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return authRequired();

  const { id } = await ctx.params;
  const body = await req.json();
  const lead = await one("SELECT id FROM leads WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.stage) {
    if (!STAGES.includes(body.stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    await setStage(Number(id), body.stage as Stage);
  }
  const editable = ["first_name", "last_name", "role", "company", "city"] as const;
  for (const field of editable) {
    if (typeof body[field] === "string") {
      await q(`UPDATE leads SET ${field} = $1, updated_at = now() WHERE id = $2`, [
        body[field].trim(),
        id,
      ]);
    }
  }
  return NextResponse.json({ lead: await one("SELECT * FROM leads WHERE id = $1", [id]) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return authRequired();

  const { id } = await ctx.params;
  // messages/replies/activities cascade
  await q("DELETE FROM leads WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
