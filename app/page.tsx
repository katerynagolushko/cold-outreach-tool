"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ALL_STAGES, STAGE_LABELS, btn } from "@/components/ui";
import type { Stage } from "@/lib/db";

interface Stats {
  byStage: Record<Stage, number>;
  totals: { leads: number; sent: number; replies: number; campaigns: number };
  recent: Array<{
    id: number;
    lead_id: number;
    type: string;
    content: string;
    created_at: string;
    first_name: string;
    last_name: string;
    company: string;
  }>;
}

const TYPE_ICONS: Record<string, string> = {
  note: "📝",
  stage_change: "🔀",
  email_sent: "📤",
  reply: "📥",
  created: "✨",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/search" className={btn.primary}>
          + Find leads
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total leads", value: stats?.totals.leads },
          { label: "Emails sent", value: stats?.totals.sent },
          { label: "Leads replied", value: stats?.totals.replies },
          { label: "Campaigns", value: stats?.totals.campaigns },
        ].map((s) => (
          <Card key={s.label}>
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{s.value ?? "–"}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pipeline
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ALL_STAGES.map((s) => (
            <Link
              key={s}
              href={`/leads?stage=${s}`}
              className="rounded-lg border border-slate-200 p-3 text-center hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <div className="text-2xl font-semibold tabular-nums">
                {stats?.byStage?.[s] ?? "–"}
              </div>
              <div className="mt-1 text-xs text-slate-500">{STAGE_LABELS[s]}</div>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h2>
        {stats && stats.recent.length === 0 && (
          <p className="text-sm text-slate-500">
            No activity yet. Start by{" "}
            <Link href="/search" className="text-indigo-600 underline">
              finding some leads
            </Link>
            .
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {stats?.recent.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span>{TYPE_ICONS[a.type] ?? "•"}</span>
              <Link
                href={`/leads/${a.lead_id}`}
                className="whitespace-nowrap font-medium text-slate-800 hover:text-indigo-600"
              >
                {a.first_name} {a.last_name}
              </Link>
              <span className="truncate text-slate-500">{a.content}</span>
              <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                {a.created_at}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
