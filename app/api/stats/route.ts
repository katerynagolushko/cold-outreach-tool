import { NextResponse } from "next/server";
import { getDb, STAGES } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const byStage: Record<string, number> = {};
  for (const s of STAGES) byStage[s] = 0;
  for (const row of db.prepare("SELECT stage, COUNT(*) AS c FROM leads GROUP BY stage").all() as {
    stage: string;
    c: number;
  }[]) {
    byStage[row.stage] = row.c;
  }
  const totals = {
    leads: (db.prepare("SELECT COUNT(*) AS c FROM leads").get() as { c: number }).c,
    sent: (
      db.prepare("SELECT COUNT(*) AS c FROM messages WHERE status != 'failed'").get() as {
        c: number;
      }
    ).c,
    replies: (
      db.prepare("SELECT COUNT(DISTINCT lead_id) AS c FROM replies").get() as { c: number }
    ).c,
    campaigns: (db.prepare("SELECT COUNT(*) AS c FROM campaigns").get() as { c: number }).c,
  };
  const recent = db
    .prepare(
      `SELECT a.*, l.first_name, l.last_name, l.company
       FROM activities a JOIN leads l ON l.id = a.lead_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT 12`
    )
    .all();
  return NextResponse.json({ byStage, totals, recent });
}
