"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Banner, StageBadge, btn } from "@/components/ui";
import type { Stage } from "@/lib/db";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

interface SentMessage {
  id: number;
  lead_id: number;
  subject: string;
  status: string;
  sent_at: string;
  error: string | null;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  stage: Stage;
  reply_count: number;
}

interface LeadRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  stage: Stage;
  messages_sent: number;
}

function render(tpl: string, l: LeadRow & { role?: string; city?: string }) {
  return tpl
    .replace(/\{\{\s*firstName\s*\}\}/gi, l.first_name)
    .replace(/\{\{\s*lastName\s*\}\}/gi, l.last_name)
    .replace(/\{\{\s*company\s*\}\}/gi, l.company)
    .replace(/\{\{\s*role\s*\}\}/gi, l.role ?? "")
    .replace(/\{\{\s*city\s*\}\}/gi, l.city ?? "");
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    live: boolean;
    sent: number;
    simulated: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const [gmailReady, setGmailReady] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCampaign(d.campaign);
        setMessages(d.messages ?? []);
      });
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setGmailReady(d.gmail));
  }, [id]);

  useEffect(load, [load]);

  const sentLeadIds = useMemo(
    () => new Set(messages.filter((m) => m.status !== "failed").map((m) => m.lead_id)),
    [messages]
  );
  const eligible = leads.filter((l) => !sentLeadIds.has(l.id));
  const previewLead = leads.find((l) => l.id === previewId) ?? eligible[0];

  function toggle(leadId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) return;
    const label = gmailReady ? "send real emails from your Gmail to" : "simulate sending to";
    if (!confirm(`This will ${label} ${selected.size} lead(s). Continue?`)) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendResult(data);
      setSelected(new Set());
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function checkReplies() {
    setChecking(true);
    setCheckNote(null);
    try {
      const res = await fetch("/api/replies/check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      setCheckNote(`Checked ${data.checked} lead(s) — ${data.newReplies} new repl${data.newReplies === 1 ? "y" : "ies"}.`);
      load();
    } catch (e) {
      setCheckNote((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function deleteCampaign() {
    if (!confirm("Delete this campaign? Sent messages stay on each lead.")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/campaigns");
  }

  if (!campaign) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/campaigns" className="text-sm text-slate-500 hover:text-indigo-600">
            ← All campaigns
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-slate-500">Subject: {campaign.subject}</p>
        </div>
        <div className="flex gap-2">
          <button className={btn.secondary} onClick={checkReplies} disabled={checking}>
            {checking ? "Checking inbox…" : "📥 Check for replies"}
          </button>
          <button className={btn.danger} onClick={deleteCampaign}>
            Delete
          </button>
        </div>
      </div>

      {gmailReady === false && (
        <Banner tone="warn">
          Gmail is not configured — sends will be <strong>simulated</strong> (recorded in the CRM,
          no real email). Add <code>GMAIL_USER</code> and <code>GMAIL_APP_PASSWORD</code> — see{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </Banner>
      )}
      {checkNote && <Banner tone="info">{checkNote}</Banner>}
      {sendResult && (
        <Banner tone={sendResult.failed > 0 ? "warn" : "success"}>
          {sendResult.live
            ? `Sent ${sendResult.sent} email(s)`
            : `Simulated ${sendResult.simulated} send(s)`}
          {sendResult.failed > 0 && `, ${sendResult.failed} failed`}
          {sendResult.skipped > 0 && `, ${sendResult.skipped} skipped (already sent)`}.
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recipients ({eligible.length} not yet contacted in this campaign)
            </h2>
            <div className="flex gap-2 text-xs">
              <button
                className="text-indigo-600 hover:underline"
                onClick={() => setSelected(new Set(eligible.map((l) => l.id)))}
              >
                Select all
              </button>
              <button className="text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {eligible.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                <button
                  className={`flex-1 text-left text-sm ${previewLead?.id === l.id ? "font-semibold text-indigo-700" : "text-slate-700"}`}
                  onClick={() => setPreviewId(l.id)}
                  title="Click to preview the personalized message"
                >
                  {l.first_name} {l.last_name}
                  <span className="ml-2 text-xs text-slate-400">{l.email}</span>
                </button>
                <StageBadge stage={l.stage} />
              </li>
            ))}
            {eligible.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-500">
                Every lead has already received this campaign.{" "}
                <Link href="/search" className="text-indigo-600 underline">
                  Find more leads
                </Link>
              </li>
            )}
          </ul>
          <button
            onClick={send}
            disabled={sending || selected.size === 0}
            className={`${btn.primary} mt-4 w-full justify-center`}
          >
            {sending
              ? "Sending…"
              : `${gmailReady ? "Send" : "Simulate send"} to ${selected.size} selected`}
          </button>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Preview {previewLead && `— as ${previewLead.first_name} ${previewLead.last_name}`}
          </h2>
          {previewLead ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="border-b border-slate-200 pb-2 text-slate-600">
                <span className="font-medium text-slate-800">To:</span> {previewLead.email}
                <br />
                <span className="font-medium text-slate-800">Subject:</span>{" "}
                {render(campaign.subject, previewLead)}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-slate-700">
                {render(campaign.body, previewLead)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Import leads to see a personalized preview.</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Send log ({messages.length})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5">Lead</th>
              <th className="px-2 py-2.5">Email</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Replied</th>
              <th className="px-2 py-2.5">Stage</th>
              <th className="px-2 py-2.5">Sent at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-2.5">
                  <Link href={`/leads/${m.lead_id}`} className="font-medium hover:text-indigo-600">
                    {m.first_name} {m.last_name}
                  </Link>
                  <div className="text-xs text-slate-400">{m.company}</div>
                </td>
                <td className="px-2 py-2.5 text-slate-600">{m.email}</td>
                <td className="px-2 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : m.status === "failed"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-600"
                    }`}
                    title={m.error ?? undefined}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  {m.reply_count > 0 ? (
                    <span className="font-semibold text-emerald-600">✓ yes</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <StageBadge stage={m.stage} />
                </td>
                <td className="px-2 py-2.5 text-xs text-slate-400">{m.sent_at}</td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  Nothing sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
