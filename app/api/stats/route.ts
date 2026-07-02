import { NextResponse } from "next/server";
import { q, one, STAGES, TS } from "@/lib/db";
import { authRequired, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return authRequired();

  const byStage: Record<string, number> = {};
  for (const s of STAGES) byStage[s] = 0;
  for (const row of await q<{ stage: string; c: number }>(
    "SELECT stage, CAST(COUNT(*) AS INTEGER) AS c FROM leads WHERE user_id = $1 GROUP BY stage",
    [user.id]
  )) {
    byStage[row.stage] = row.c;
  }
  const totals = await one<{ leads: number; sent: number; replies: number; campaigns: number }>(
    `SELECT
      CAST((SELECT COUNT(*) FROM leads WHERE user_id = $1) AS INTEGER) AS leads,
      CAST((SELECT COUNT(*) FROM messages m JOIN leads l ON l.id = m.lead_id
        WHERE l.user_id = $1 AND m.status != 'failed') AS INTEGER) AS sent,
      CAST((SELECT COUNT(DISTINCT r.lead_id) FROM replies r JOIN leads l ON l.id = r.lead_id
        WHERE l.user_id = $1) AS INTEGER) AS replies,
      CAST((SELECT COUNT(*) FROM campaigns WHERE user_id = $1) AS INTEGER) AS campaigns`,
    [user.id]
  );
  const recent = await q(
    `SELECT a.id, a.lead_id, a.type, a.content, to_char(a.created_at, '${TS}') AS created_at,
      l.first_name, l.last_name, l.company
     FROM activities a JOIN leads l ON l.id = a.lead_id
     WHERE l.user_id = $1
     ORDER BY a.created_at DESC, a.id DESC LIMIT 12`,
    [user.id]
  );
  return NextResponse.json({ byStage, totals, recent });
}
