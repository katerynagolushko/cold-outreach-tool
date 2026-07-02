import { NextRequest, NextResponse } from "next/server";
import { searchLeads, type ProviderName } from "@/lib/providers";
import { q } from "@/lib/db";
import { authRequired, currentUser } from "@/lib/auth";
import { effectiveCreds } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return authRequired();

  try {
    const body = await req.json();
    const query = {
      role: String(body.role ?? "").trim(),
      company: String(body.company ?? "").trim(),
      city: String(body.city ?? "").trim(),
      limit: Number(body.limit ?? 12),
    };
    if (!query.role && !query.company && !query.city) {
      return NextResponse.json({ error: "Enter at least one keyword" }, { status: 400 });
    }
    const creds = await effectiveCreds(user.id);
    const result = await searchLeads(query, (body.provider as ProviderName) ?? "auto", {
      apollo: creds.apolloApiKey || undefined,
      hunter: creds.hunterApiKey || undefined,
    });

    // annotate which results are already in this user's CRM
    const existing = new Set(
      (
        await q<{ email: string }>("SELECT email FROM leads WHERE user_id = $1", [user.id])
      ).map((r) => r.email.toLowerCase())
    );
    const leads = result.leads.map((l) => ({
      ...l,
      already_imported: existing.has(l.email.toLowerCase()),
    }));
    return NextResponse.json({ ...result, leads });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
