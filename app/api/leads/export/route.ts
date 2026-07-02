import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function csvField(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.first_name, l.last_name, l.email, l.role, l.company, l.city, l.stage, l.source,
        (SELECT COUNT(*) FROM messages m WHERE m.lead_id = l.id AND m.status != 'failed') AS emails_sent,
        (SELECT COUNT(*) FROM replies r WHERE r.lead_id = l.id) AS replies,
        l.created_at
       FROM leads l ORDER BY l.id`
    )
    .all() as Record<string, unknown>[];
  const header = [
    "first_name", "last_name", "email", "role", "company", "city",
    "stage", "source", "emails_sent", "replies", "created_at",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) => header.map((h) => csvField(r[h])).join(",")),
  ].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads.csv"',
    },
  });
}
