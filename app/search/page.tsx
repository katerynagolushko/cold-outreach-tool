"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Banner, btn, input } from "@/components/ui";

interface FoundLead {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company: string;
  city: string;
  source: string;
  already_imported: boolean;
}

interface SearchResponse {
  provider: string;
  demo: boolean;
  note?: string;
  leads: FoundLead[];
  error?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [role, setRole] = useState("Event Manager");
  const [company, setCompany] = useState("Co-working space");
  const [city, setCity] = useState("London");
  const [provider, setProvider] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ imported: number; skipped: number } | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setImported(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, company, city, provider, limit: 15 }),
      });
      const data: SearchResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResult(data);
      setSelected(new Set(data.leads.filter((l) => !l.already_imported).map((l) => l.email)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function importSelected() {
    if (!result) return;
    setImporting(true);
    try {
      const leads = result.leads.filter((l) => selected.has(l.email));
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      setImported(data);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lead Search</h1>
      <Card>
        <form onSubmit={search} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Role / title</label>
            <input className={input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Event Manager" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Company type</label>
            <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Co-working space" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
            <input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="London" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Data source</label>
            <select className={input} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="auto">Auto (best available)</option>
              <option value="apollo">Apollo.io</option>
              <option value="hunter">Hunter.io</option>
              <option value="demo">Demo data</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className={`${btn.primary} w-full justify-center`}>
              {loading ? "Searching…" : "Search leads"}
            </button>
          </div>
        </form>
      </Card>

      {error && <Banner tone="error">{error}</Banner>}
      {result?.note && <Banner tone="warn">{result.note}</Banner>}
      {imported && (
        <Banner tone="success">
          Imported {imported.imported} lead{imported.imported === 1 ? "" : "s"}
          {imported.skipped > 0 && ` (${imported.skipped} skipped — already in CRM)`}.{" "}
          <button className="underline" onClick={() => router.push("/leads")}>
            View leads →
          </button>
        </Banner>
      )}

      {result && (
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="text-sm text-slate-600">
              <span className="font-semibold">{result.leads.length}</span> results from{" "}
              <span className="font-semibold">{result.provider}</span>
            </div>
            <button
              className={btn.primary}
              onClick={importSelected}
              disabled={importing || selected.size === 0}
            >
              {importing ? "Importing…" : `Import ${selected.size} selected`}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5"></th>
                <th className="px-2 py-2.5">Name</th>
                <th className="px-2 py-2.5">Email</th>
                <th className="px-2 py-2.5">Role</th>
                <th className="px-2 py-2.5">Company</th>
                <th className="px-2 py-2.5">City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.leads.map((l) => (
                <tr key={l.email} className={l.already_imported ? "opacity-50" : ""}>
                  <td className="px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(l.email)}
                      disabled={l.already_imported}
                      onChange={() => toggle(l.email)}
                    />
                  </td>
                  <td className="px-2 py-2.5 font-medium">
                    {l.first_name} {l.last_name}
                    {l.already_imported && (
                      <span className="ml-2 text-xs text-slate-400">already in CRM</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-slate-600">{l.email}</td>
                  <td className="px-2 py-2.5 text-slate-600">{l.role}</td>
                  <td className="px-2 py-2.5 text-slate-600">{l.company}</td>
                  <td className="px-2 py-2.5 text-slate-600">{l.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
