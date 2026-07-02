"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, Banner, StageBadge, ALL_STAGES, STAGE_LABELS, btn, input } from "@/components/ui";
import type { Stage } from "@/lib/db";

/** Minimal CSV parser with support for quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function csvToLeads(text: string): { leads: Record<string, string>[]; error?: string } {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) return { leads: [], error: "Need a header row plus at least one lead row." };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const emailIdx = header.findIndex((h) => h.includes("email"));
  const firstIdx = header.findIndex((h) => h === "first_name" || h === "firstname" || h === "first");
  if (emailIdx === -1 || firstIdx === -1) {
    return { leads: [], error: "Header must include first_name and email columns." };
  }
  const col = (name: string[]) => header.findIndex((h) => name.includes(h));
  const lastIdx = col(["last_name", "lastname", "last", "surname"]);
  const roleIdx = col(["role", "title", "job_title", "position"]);
  const companyIdx = col(["company", "organisation", "organization"]);
  const cityIdx = col(["city", "location"]);
  const leads = rows.slice(1).map((r) => ({
    first_name: r[firstIdx]?.trim() ?? "",
    last_name: lastIdx >= 0 ? (r[lastIdx]?.trim() ?? "") : "",
    email: r[emailIdx]?.trim() ?? "",
    role: roleIdx >= 0 ? (r[roleIdx]?.trim() ?? "") : "",
    company: companyIdx >= 0 ? (r[companyIdx]?.trim() ?? "") : "",
    city: cityIdx >= 0 ? (r[cityIdx]?.trim() ?? "") : "",
    source: "csv",
  }));
  return { leads };
}

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
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);

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

  async function importCsv() {
    setImportMsg(null);
    const { leads: parsed, error } = csvToLeads(csvText);
    if (error) {
      setImportMsg({ tone: "error", text: error });
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsed }),
      });
      const data = await res.json();
      setImportMsg({
        tone: "success",
        text: `Imported ${data.imported} lead(s)${data.skipped ? `, ${data.skipped} skipped (duplicate or missing name/email)` : ""}.`,
      });
      setCsvText("");
      load();
    } finally {
      setImporting(false);
    }
  }

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
          <button className={btn.secondary} onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Close import" : "Import CSV"}
          </button>
          <a href="/api/leads/export" className={btn.secondary}>
            Export CSV
          </a>
          <Link href="/search" className={btn.primary}>
            + Find leads
          </Link>
        </div>
      </div>

      {showImport && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Import leads from CSV
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Paste CSV with a header row. Required columns: <code>first_name</code>,{" "}
            <code>email</code>. Optional: <code>last_name</code>, <code>role</code>,{" "}
            <code>company</code>, <code>city</code>.
          </p>
          <textarea
            className={`${input} min-h-36 font-mono text-xs`}
            placeholder={"first_name,last_name,email,role,company,city\nJane,Smith,jane@acme.com,Event Manager,Acme Spaces,London"}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button className={btn.primary} onClick={importCsv} disabled={importing || !csvText.trim()}>
              {importing ? "Importing…" : "Import"}
            </button>
            {importMsg && <Banner tone={importMsg.tone}>{importMsg.text}</Banner>}
          </div>
        </Card>
      )}

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
