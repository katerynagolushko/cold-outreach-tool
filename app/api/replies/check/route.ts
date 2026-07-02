import { NextResponse } from "next/server";
import { getDb, addActivity, setStage, type Lead } from "@/lib/db";
import { gmailConfigured, findRepliesFrom } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Scan the Gmail inbox for replies from any contacted lead and update the CRM:
 * records the reply and moves the lead to the "replied" stage.
 */
export async function POST() {
  if (!gmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD to enable reply tracking.",
      },
      { status: 400 }
    );
  }
  const db = getDb();
  const contacted = db
    .prepare(
      `SELECT l.*, (SELECT MIN(sent_at) FROM messages m WHERE m.lead_id = l.id AND m.status = 'sent') AS first_sent
       FROM leads l
       WHERE EXISTS (SELECT 1 FROM messages m WHERE m.lead_id = l.id AND m.status = 'sent')`
    )
    .all() as Array<Lead & { first_sent: string }>;

  if (contacted.length === 0) {
    return NextResponse.json({ checked: 0, newReplies: 0, note: "No leads have been emailed yet." });
  }

  const earliest = contacted
    .map((l) => new Date(l.first_sent + "Z"))
    .reduce((a, b) => (a < b ? a : b));

  try {
    const inbox = await findRepliesFrom(
      contacted.map((l) => l.email),
      earliest
    );
    const byEmail = new Map(contacted.map((l) => [l.email.toLowerCase(), l]));
    const insert = db.prepare(
      `INSERT INTO replies (lead_id, from_email, subject, snippet, received_at, imap_uid)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(lead_id, imap_uid) DO NOTHING`
    );

    let newReplies = 0;
    for (const r of inbox) {
      const lead = byEmail.get(r.fromEmail);
      if (!lead) continue;
      const res = insert.run(
        lead.id,
        r.fromEmail,
        r.subject,
        "",
        r.receivedAt.toISOString(),
        r.uid
      );
      if (res.changes > 0) {
        newReplies++;
        addActivity(db, lead.id, "reply", `Replied: "${r.subject}"`);
        if (lead.stage === "new" || lead.stage === "contacted") {
          setStage(db, lead.id, "replied");
        }
      }
    }
    return NextResponse.json({ checked: contacted.length, newReplies });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
