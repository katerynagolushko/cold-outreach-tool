import type { FoundLead, SearchQuery, SearchResult } from "./types";

const FIRST_NAMES = [
  "Amelia", "Oliver", "Priya", "James", "Sofia", "Daniel", "Chloe", "Marcus",
  "Isabella", "Tom", "Yasmin", "Leo", "Hannah", "Ravi", "Emma", "Nathan",
  "Freya", "Adam", "Zara", "Ben",
];
const LAST_NAMES = [
  "Clarke", "Bennett", "Sharma", "Whitfield", "Marchetti", "Okafor", "Reid",
  "Nguyen", "Fletcher", "Kowalski", "Hughes", "Patel", "Sanders", "Moreau",
  "Blackwood", "Ito", "Andersson", "Doyle", "Vargas", "Lindqvist",
];
const COMPANY_PREFIX = [
  "Huddle", "Nest", "Forge", "Orbit", "Anchor", "Beacon", "Canvas", "Dockside",
  "Ember", "Fable", "Garden", "Harbour", "Junction", "Kindred", "Loft",
  "Meadow", "Nomad", "Outpost", "Pivot", "Quarter",
];

function suffixFor(companyType: string): string {
  const t = companyType.toLowerCase();
  if (t.includes("cowork") || t.includes("co-work")) return ["Spaces", "Cowork", "Workspace", "Hub", "Studios"][0];
  if (t.includes("hotel")) return "Hotels";
  if (t.includes("agency")) return "Agency";
  if (t.includes("studio")) return "Studios";
  return "Group";
}

/** Simple deterministic hash so the same query returns the same demo leads. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates realistic-looking sample leads so the tool works before any
 * lead-data API key is configured. All email addresses use the reserved
 * `.example` TLD, so nothing sent to them can ever reach a real person.
 */
export function searchDemo(q: SearchQuery): SearchResult {
  const seed = hash(`${q.role}|${q.company}|${q.city}`);
  const n = Math.min(q.limit ?? 12, 20);
  const suffixes = ["Spaces", "Cowork", "Workspace", "Hub", "Studios", suffixFor(q.company)];
  const leads: FoundLead[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; leads.length < n && i < n * 3; i++) {
    const r = (seed + i * 2654435761) >>> 0;
    const first = FIRST_NAMES[r % FIRST_NAMES.length];
    const last = LAST_NAMES[(r >>> 4) % LAST_NAMES.length];
    const company = `${COMPANY_PREFIX[(r >>> 8) % COMPANY_PREFIX.length]} ${suffixes[(r >>> 12) % suffixes.length]}`;
    const domain = company.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}.example`;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);
    leads.push({
      first_name: first,
      last_name: last,
      email,
      role: q.role || "Event Manager",
      company,
      city: q.city || "London",
      source: "demo",
    });
  }

  return {
    provider: "Demo data",
    demo: true,
    note:
      "These are sample leads (no lead-data API key configured). Add an Apollo or Hunter API key in Settings to search real contacts. Demo emails use the reserved .example TLD and can never reach a real inbox.",
    leads,
  };
}
