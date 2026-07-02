import { NextRequest, NextResponse } from "next/server";
import { getDb, addActivity, STAGES, type Stage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const stage = req.nextUrl.searchParams.get("stage");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  let sql = `
    SELECT l.*,
      (SELECT COUNT(*) FROM messages m WHERE m.lead_id = l.id AND m.status != 'failed') AS messages_sent,
      (SELECT COUNT(*) FROM replies r WHERE r.lead_id = l.id) AS reply_count,
      (SELECT MAX(sent_at) FROM messages m WHERE m.lead_id = l.id) AS last_contacted
    FROM leads l`;
  const where: string[] = [];
  const params: unknown[] = [];
  if (stage && STAGES.includes(stage as Stage)) {
    where.push("l.stage = ?");
    params.push(stage);
  }
  if (q) {
    where.push(
      "(l.first_name || ' ' || l.last_name || ' ' || l.email || ' ' || l.company || ' ' || l.role || ' ' || l.city) LIKE ?"
    );
    params.push(`%${q}%`);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY l.updated_at DESC";
  return NextResponse.json({ leads: db.prepare(sql).all(...params) });
}

// Import one or many leads: { leads: [{first_name, last_name, email, role, company, city, source}] }
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const leads = Array.isArray(body.leads) ? body.leads : [body];
  const ins = db.prepare(`
    INSERT INTO leads (first_name, last_name, email, role, company, city, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO NOTHING
  `);
  let imported = 0;
  let skipped = 0;
  for (const l of leads) {
    const email = String(l.email ?? "").trim().toLowerCase();
    const first = String(l.first_name ?? "").trim();
    if (!email || !email.includes("@") || !first) {
      skipped++;
      continue;
    }
    const r = ins.run(
      first,
      String(l.last_name ?? "").trim(),
      email,
      String(l.role ?? "").trim(),
      String(l.company ?? "").trim(),
      String(l.city ?? "").trim(),
      String(l.source ?? "manual")
    );
    if (r.changes > 0) {
      imported++;
      addActivity(db, Number(r.lastInsertRowid), "created", `Imported from ${l.source ?? "manual"}`);
    } else {
      skipped++;
    }
  }
  return NextResponse.json({ imported, skipped });
}
