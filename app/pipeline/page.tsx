"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ALL_STAGES, STAGE_LABELS, STAGE_STYLES } from "@/components/ui";
import type { Stage } from "@/lib/db";

interface LeadRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company: string;
  stage: Stage;
  reply_count: number;
  messages_sent: number;
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const load = useCallback(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads));
  }, []);

  useEffect(load, [load]);

  async function moveTo(id: number, stage: Stage) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drag cards between stages, or use the arrows on each card.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ALL_STAGES.map((stage) => {
          const items = leads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage(null)}
              onDrop={() => {
                if (dragId != null) moveTo(dragId, stage);
                setDragId(null);
                setOverStage(null);
              }}
              className={`flex min-h-[60vh] flex-col rounded-xl border bg-white p-2 ${
                overStage === stage ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STAGE_STYLES[stage]}`}
                >
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {items.map((l) => {
                  const idx = ALL_STAGES.indexOf(l.stage);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      className="cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-indigo-300 active:cursor-grabbing"
                    >
                      <Link
                        href={`/leads/${l.id}`}
                        className="block text-sm font-medium text-slate-800 hover:text-indigo-600"
                      >
                        {l.first_name} {l.last_name}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{l.company}</div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {l.messages_sent > 0 && `📤${l.messages_sent} `}
                          {l.reply_count > 0 && `📥${l.reply_count}`}
                        </span>
                        <span className="flex gap-1">
                          <button
                            aria-label="Move left"
                            disabled={idx === 0}
                            onClick={() => moveTo(l.id, ALL_STAGES[idx - 1])}
                            className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                          >
                            ◀
                          </button>
                          <button
                            aria-label="Move right"
                            disabled={idx === ALL_STAGES.length - 1}
                            onClick={() => moveTo(l.id, ALL_STAGES[idx + 1])}
                            className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                          >
                            ▶
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
