import { NextRequest, NextResponse } from "next/server";
import { q, one, addActivity, setStage, type Lead, type Campaign } from "@/lib/db";
import { renderTemplate } from "@/lib/template";
import { gmailConfigured, sendEmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SEND_DELAY_MS = 1500; // pause between emails to stay well under Gmail rate limits

/**
 * Send a campaign to the given leads.
 * Body: { leadIds: number[] }
 * If Gmail is not configured, messages are recorded as "simulated" (dry run)
 * so the whole pipeline can be exercised without sending real email.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const campaign = await one<Campaign>("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const body = await req.json();
  const leadIds: number[] = Array.isArray(body.leadIds) ? body.leadIds.map(Number) : [];
  if (leadIds.length === 0) {
    return NextResponse.json({ error: "Select at least one lead" }, { status: 400 });
  }

  const live = gmailConfigured();
  const results: Array<{ leadId: number; email?: string; status: string; error?: string }> = [];

  const insertMsg = (
    leadId: number,
    subject: string,
    text: string,
    status: string,
    gmailId: string | null,
    error: string | null
  ) =>
    q(
      `INSERT INTO messages (lead_id, campaign_id, subject, body, status, gmail_message_id, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [leadId, id, subject, text, status, gmailId, error]
    );

  for (const leadId of leadIds) {
    const lead = await one<Lead>("SELECT * FROM leads WHERE id = $1", [leadId]);
    if (!lead) {
      results.push({ leadId, status: "skipped", error: "Lead not found" });
      continue;
    }
    const already = await one<{ c: number }>(
      `SELECT CAST(COUNT(*) AS INTEGER) AS c FROM messages
       WHERE lead_id = $1 AND campaign_id = $2 AND status != 'failed'`,
      [leadId, id]
    );
    if (already && already.c > 0) {
      results.push({ leadId, email: lead.email, status: "skipped", error: "Already sent this campaign" });
      continue;
    }

    const subject = renderTemplate(campaign.subject, lead);
    const text = renderTemplate(campaign.body, lead);

    if (!live) {
      await insertMsg(leadId, subject, text, "simulated", null, null);
      await addActivity(leadId, "email_sent", `Simulated send (Gmail not configured): "${subject}"`);
      if (lead.stage === "new") await setStage(leadId, "contacted");
      results.push({ leadId, email: lead.email, status: "simulated" });
      continue;
    }

    try {
      const { messageId } = await sendEmail({ to: lead.email, subject, text });
      await insertMsg(leadId, subject, text, "sent", messageId, null);
      await addActivity(leadId, "email_sent", `Sent "${subject}"`);
      if (lead.stage === "new") await setStage(leadId, "contacted");
      results.push({ leadId, email: lead.email, status: "sent" });
    } catch (e) {
      const err = (e as Error).message;
      await insertMsg(leadId, subject, text, "failed", null, err);
      results.push({ leadId, email: lead.email, status: "failed", error: err });
    }
    if (leadIds.length > 1) await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const simulated = results.filter((r) => r.status === "simulated").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  return NextResponse.json({ live, sent, simulated, failed, skipped, results });
}
