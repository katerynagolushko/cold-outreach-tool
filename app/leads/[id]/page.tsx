"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, StageBadge, ALL_STAGES, STAGE_LABELS, btn, input } from "@/components/ui";
import type { Stage } from "@/lib/db";

interface LeadDetail {
  lead: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    company: string;
    city: string;
    source: string;
    stage: Stage;
    created_at: string;
  };
  messages: Array<{
    id: number;
    subject: string;
    body: string;
    status: string;
    sent_at: string;
  }>;
  replies: Array<{ id: number; subject: string; received_at: string }>;
  activities: Array<{ id: number; type: string; content: string; created_at: string }>;
}

const TYPE_ICONS: Record<string, string> = {
  note: "📝",
  stage_change: "🔀",
  email_sent: "📤",
  reply: "📥",
  created: "✨",
};

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<LeadDetail | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  useEffect(load, [load]);

  async function changeStage(stage: Stage) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    await fetch(`/api/leads/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setNote("");
    setSaving(false);
    load();
  }

  async function deleteLead() {
    if (!confirm("Delete this lead and all its history?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.push("/leads");
  }

  if (!data) return <p className="text-slate-500">Loading…</p>;
  const { lead } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="text-sm text-slate-500 hover:text-indigo-600">
            ← All leads
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="text-slate-500">
            {lead.role} · {lead.company} · {lead.city}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {lead.email} <span className="text-slate-300">|</span> source: {lead.source}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={lead.stage} />
          <button onClick={deleteLead} className={btn.danger}>
            Delete
          </button>
        </div>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pipeline stage
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => changeStage(s)}
              className={
                s === lead.stage
                  ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              }
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Emails sent ({data.messages.length})
          </h2>
          {data.messages.length === 0 && (
            <p className="text-sm text-slate-500">
              Nothing sent yet. Add this lead to a{" "}
              <Link href="/campaigns" className="text-indigo-600 underline">
                campaign
              </Link>
              .
            </p>
          )}
          <ul className="space-y-3">
            {data.messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.subject}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      m.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : m.status === "failed"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{m.body}</p>
                <p className="mt-2 text-xs text-slate-400">{m.sent_at}</p>
              </li>
            ))}
          </ul>

          {data.replies.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Replies ({data.replies.length})
              </h2>
              <ul className="space-y-2">
                {data.replies.map((r) => (
                  <li key={r.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                    <span className="font-medium">📥 {r.subject || "(no subject)"}</span>
                    <span className="ml-2 text-xs text-slate-400">{r.received_at}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Notes & activity
          </h2>
          <form onSubmit={addNote} className="mb-4 flex gap-2">
            <input
              className={input}
              placeholder="Add a note… (e.g. call booked for Friday)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className={btn.secondary} disabled={saving || !note.trim()}>
              Add
            </button>
          </form>
          <ul className="space-y-2.5">
            {data.activities.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 text-sm">
                <span>{TYPE_ICONS[a.type] ?? "•"}</span>
                <div>
                  <span className="text-slate-700">{a.content}</span>
                  <span className="ml-2 text-xs text-slate-400">{a.created_at}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
