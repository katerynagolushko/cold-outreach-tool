import { NextRequest, NextResponse } from "next/server";
import { q, TS } from "@/lib/db";
import { authRequired, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return authRequired();

  const campaigns = await q(
    `SELECT c.*, to_char(c.created_at, '${TS}') AS created_at,
      CAST((SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status != 'failed') AS INTEGER) AS sent_count,
      CAST((SELECT COUNT(DISTINCT r.lead_id) FROM replies r
        JOIN messages m ON m.lead_id = r.lead_id WHERE m.campaign_id = c.id) AS INTEGER) AS reply_count
    FROM campaigns c WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
    [user.id]
  );
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return authRequired();

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const template = String(body.body ?? "").trim();
  if (!name || !subject || !template) {
    return NextResponse.json({ error: "Name, subject and message are required" }, { status: 400 });
  }
  const rows = await q<{ id: number }>(
    "INSERT INTO campaigns (user_id, name, subject, body) VALUES ($1, $2, $3, $4) RETURNING id",
    [user.id, name, subject, template]
  );
  return NextResponse.json({ id: rows[0].id });
}
