import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const campaigns = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status != 'failed') AS sent_count,
        (SELECT COUNT(DISTINCT r.lead_id) FROM replies r
          JOIN messages m ON m.lead_id = r.lead_id WHERE m.campaign_id = c.id) AS reply_count
      FROM campaigns c ORDER BY c.created_at DESC`
    )
    .all();
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const template = String(body.body ?? "").trim();
  if (!name || !subject || !template) {
    return NextResponse.json({ error: "Name, subject and message are required" }, { status: 400 });
  }
  const r = db
    .prepare("INSERT INTO campaigns (name, subject, body) VALUES (?, ?, ?)")
    .run(name, subject, template);
  return NextResponse.json({ id: Number(r.lastInsertRowid) });
}
