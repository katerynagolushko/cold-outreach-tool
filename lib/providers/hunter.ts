import type { FoundLead, SearchQuery, SearchResult } from "./types";

/**
 * Hunter.io discover + domain-search. Requires a Hunter API key.
 * Hunter works domain-first: we discover companies matching the query,
 * then pull email addresses for each domain, preferring role matches.
 */
export async function searchHunter(q: SearchQuery, apiKey?: string): Promise<SearchResult> {
  if (!apiKey) throw new Error("Hunter is not configured — add your API key in Settings.");

  const discover = await fetch("https://api.hunter.io/v2/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({
      query: [q.company, q.city].filter(Boolean).join(" "),
      headquarters_location: q.city ? { include: [q.city] } : undefined,
    }),
  });
  if (!discover.ok) {
    throw new Error(`Hunter discover error ${discover.status}: ${(await discover.text()).slice(0, 300)}`);
  }
  const companies: { domain?: string; organization?: string }[] =
    (await discover.json()).data ?? [];

  const leads: FoundLead[] = [];
  for (const c of companies.slice(0, 10)) {
    if (!c.domain || leads.length >= (q.limit ?? 25)) continue;
    const ds = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(c.domain)}&limit=5&api_key=${apiKey}`
    );
    if (!ds.ok) continue;
    const emails: Record<string, unknown>[] = (await ds.json()).data?.emails ?? [];
    for (const e of emails) {
      const position = String(e.position ?? "");
      const roleWords = q.role.toLowerCase().split(/\s+/).filter(Boolean);
      const matchesRole =
        roleWords.length === 0 || roleWords.some((w) => position.toLowerCase().includes(w));
      if (!matchesRole || !e.value || !e.first_name) continue;
      leads.push({
        first_name: String(e.first_name),
        last_name: String(e.last_name ?? ""),
        email: String(e.value),
        role: position || q.role,
        company: c.organization ?? c.domain,
        city: q.city,
        source: "hunter",
      });
    }
  }
  return { provider: "Hunter.io", demo: false, leads };
}
