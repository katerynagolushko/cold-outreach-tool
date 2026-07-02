import { NextRequest, NextResponse } from "next/server";
import { q, addActivity, STAGES, TS, type Stage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");
  const search = req.nextUrl.searchParams.get("q")?.trim();
  let sql = `
    SELECT l.*,
      to_char(l.created_at, '${TS}') AS created_at,
      CAST((SELECT COUNT(*) FROM messages m WHERE m.lead_id = l.id AND m.status != 'failed') AS INTEGER) AS messages_sent,
      CAST((SELECT COUNT(*) FROM replies r WHERE r.lead_id = l.id) AS INTEGER) AS reply_count,
      (SELECT to_char(MAX(sent_at), '${TS}') FROM messages m WHERE m.lead_id = l.id) AS last_contacted
    FROM leads l`;
  const where: string[] = [];
  const params: unknown[] = [];
  if (stage && STAGES.includes(stage as Stage)) {
    params.push(stage);
    where.push(`l.stage = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(l.first_name || ' ' || l.last_name || ' ' || l.email || ' ' || l.company || ' ' || l.role || ' ' || l.city) ILIKE $${params.length}`
    );
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY l.updated_at DESC";
  return NextResponse.json({ leads: await q(sql, params) });
}

// Import one or many leads: { leads: [{first_name, last_name, email, role, company, city, source}] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const leads = Array.isArray(body.leads) ? body.leads : [body];
  let imported = 0;
  let skipped = 0;
  for (const l of leads) {
    const email = String(l.email ?? "").trim().toLowerCase();
    const first = String(l.first_name ?? "").trim();
    if (!email || !email.includes("@") || !first) {
      skipped++;
      continue;
    }
    const rows = await q<{ id: number }>(
      `INSERT INTO leads (first_name, last_name, email, role, company, city, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [
        first,
        String(l.last_name ?? "").trim(),
        email,
        String(l.role ?? "").trim(),
        String(l.company ?? "").trim(),
        String(l.city ?? "").trim(),
        String(l.source ?? "manual"),
      ]
    );
    if (rows.length > 0) {
      imported++;
      await addActivity(rows[0].id, "created", `Imported from ${l.source ?? "manual"}`);
    } else {
      skipped++;
    }
  }
  return NextResponse.json({ imported, skipped });
}
