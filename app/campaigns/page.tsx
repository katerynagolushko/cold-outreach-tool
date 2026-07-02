"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Banner, btn, input } from "@/components/ui";

interface CampaignRow {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  sent_count: number;
  reply_count: number;
}

const DEFAULT_BODY = `Hi {{firstName}},

I came across {{company}} and loved what you're doing. We help teams like yours run smoother events with less admin.

Would you be open to a quick 15-minute call next week?

Best,
`;

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Quick question, {{firstName}}");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns));
  }, []);

  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create campaign");
      setShowForm(false);
      setName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <button className={btn.primary} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-4">
            {error && <Banner tone="error">{error}</Banner>}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Campaign name</label>
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="London co-working outreach — July"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email subject</label>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Message — use <code className="rounded bg-slate-100 px-1">{"{{firstName}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{company}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{role}}"}</code>,{" "}
                <code className="rounded bg-slate-100 px-1">{"{{city}}"}</code> for personalization
              </label>
              <textarea
                className={`${input} min-h-48 font-mono text-sm`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <button className={btn.primary} disabled={saving}>
              {saving ? "Creating…" : "Create campaign"}
            </button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {campaigns?.map((c) => (
          <Link key={c.id} href={`/campaigns/${c.id}`}>
            <Card className="h-full transition hover:border-indigo-300 hover:shadow">
              <div className="font-semibold">{c.name}</div>
              <div className="mt-1 truncate text-sm text-slate-500">Subject: {c.subject}</div>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-slate-600">
                  📤 <span className="font-semibold tabular-nums">{c.sent_count}</span> sent
                </span>
                <span className="text-slate-600">
                  📥 <span className="font-semibold tabular-nums">{c.reply_count}</span> replied
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-400">Created {c.created_at}</div>
            </Card>
          </Link>
        ))}
        {campaigns && campaigns.length === 0 && !showForm && (
          <Card className="sm:col-span-2">
            <p className="text-sm text-slate-500">
              No campaigns yet. Create one to start sending personalized outreach.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
