import { NextResponse } from "next/server";
import { q, one, STAGES, TS } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const byStage: Record<string, number> = {};
  for (const s of STAGES) byStage[s] = 0;
  for (const row of await q<{ stage: string; c: number }>(
    "SELECT stage, CAST(COUNT(*) AS INTEGER) AS c FROM leads GROUP BY stage"
  )) {
    byStage[row.stage] = row.c;
  }
  const totals = await one<{ leads: number; sent: number; replies: number; campaigns: number }>(
    `SELECT
      CAST((SELECT COUNT(*) FROM leads) AS INTEGER) AS leads,
      CAST((SELECT COUNT(*) FROM messages WHERE status != 'failed') AS INTEGER) AS sent,
      CAST((SELECT COUNT(DISTINCT lead_id) FROM replies) AS INTEGER) AS replies,
      CAST((SELECT COUNT(*) FROM campaigns) AS INTEGER) AS campaigns`
  );
  const recent = await q(
    `SELECT a.id, a.lead_id, a.type, a.content, to_char(a.created_at, '${TS}') AS created_at,
      l.first_name, l.last_name, l.company
     FROM activities a JOIN leads l ON l.id = a.lead_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT 12`
  );
  return NextResponse.json({ byStage, totals, recent });
}
