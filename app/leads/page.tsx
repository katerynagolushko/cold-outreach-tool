"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, StageBadge, ALL_STAGES, STAGE_LABELS, btn, input } from "@/components/ui";
import type { Stage } from "@/lib/db";

interface LeadRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company: string;
  city: string;
  source: string;
  stage: Stage;
  messages_sent: number;
  reply_count: number;
  last_contacted: string | null;
}

function LeadsInner() {
  const params = useSearchParams();
  const [stage, setStage] = useState<string>(params.get("stage") ?? "");
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState<LeadRow[] | null>(null);

  const load = useCallback(() => {
    const usp = new URLSearchParams();
    if (stage) usp.set("stage", stage);
    if (q) usp.set("q", q);
    fetch(`/api/leads?${usp}`)
      .then((r) => r.json())
      .then((d) => setLeads(d.leads));
  }, [stage, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <div className="flex items-center gap-2">
          <input
            className={`${input} w-56`}
            placeholder="Search name, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={`${input} w-40`} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {ALL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <Link href="/search" className={btn.primary}>
            + Find leads
          </Link>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5">Name</th>
              <th className="px-2 py-2.5">Company</th>
              <th className="px-2 py-2.5">Email</th>
              <th className="px-2 py-2.5">Stage</th>
              <th className="px-2 py-2.5 text-center">Sent</th>
              <th className="px-2 py-2.5 text-center">Replies</th>
              <th className="px-2 py-2.5">Last contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads?.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <Link href={`/leads/${l.id}`} className="font-medium text-slate-800 hover:text-indigo-600">
                    {l.first_name} {l.last_name}
                  </Link>
                  <div className="text-xs text-slate-400">{l.role}</div>
                </td>
                <td className="px-2 py-2.5 text-slate-600">
                  {l.company}
                  <div className="text-xs text-slate-400">{l.city}</div>
                </td>
                <td className="px-2 py-2.5 text-slate-600">{l.email}</td>
                <td className="px-2 py-2.5">
                  <StageBadge stage={l.stage} />
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums">{l.messages_sent}</td>
                <td className="px-2 py-2.5 text-center tabular-nums">
                  {l.reply_count > 0 ? (
                    <span className="font-semibold text-emerald-600">{l.reply_count}</span>
                  ) : (
                    0
                  )}
                </td>
                <td className="px-2 py-2.5 text-xs text-slate-400">{l.last_contacted ?? "—"}</td>
              </tr>
            ))}
            {leads && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No leads yet.{" "}
                  <Link href="/search" className="text-indigo-600 underline">
                    Run a lead search
                  </Link>{" "}
                  to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsInner />
    </Suspense>
  );
}
