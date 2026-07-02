import type { FoundLead, SearchQuery, SearchResult } from "./types";

/**
 * Apollo.io people search. Requires APOLLO_API_KEY.
 * https://docs.apollo.io/reference/people-search
 * Note: revealing email addresses consumes Apollo credits.
 */
export async function searchApollo(q: SearchQuery): Promise<SearchResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY is not configured");

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      person_titles: q.role ? [q.role] : undefined,
      person_locations: q.city ? [q.city] : undefined,
      q_organization_keyword_tags: q.company ? [q.company] : undefined,
      contact_email_status: ["verified"],
      per_page: Math.min(q.limit ?? 25, 100),
      page: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const people: Record<string, unknown>[] = [
    ...(data.people ?? []),
    ...(data.contacts ?? []),
  ];
  const leads: FoundLead[] = people
    .map((p) => {
      const org = (p.organization ?? {}) as Record<string, unknown>;
      return {
        first_name: String(p.first_name ?? ""),
        last_name: String(p.last_name ?? ""),
        email: String(p.email ?? ""),
        role: String(p.title ?? q.role),
        company: String(org.name ?? p.organization_name ?? ""),
        city: String(p.city ?? q.city),
        source: "apollo" as const,
      };
    })
    .filter((l) => l.email && l.email !== "email_not_unlocked@domain.com" && l.first_name);
  return { provider: "Apollo.io", demo: false, leads };
}
