import { searchApollo } from "./apollo";
import { searchHunter } from "./hunter";
import { searchDemo } from "./demo";
import type { SearchQuery, SearchResult } from "./types";

export type ProviderName = "auto" | "apollo" | "hunter" | "demo";

export function availableProviders() {
  return {
    apollo: Boolean(process.env.APOLLO_API_KEY),
    hunter: Boolean(process.env.HUNTER_API_KEY),
    demo: true,
  };
}

export async function searchLeads(
  q: SearchQuery,
  provider: ProviderName = "auto"
): Promise<SearchResult> {
  if (provider === "apollo") return searchApollo(q);
  if (provider === "hunter") return searchHunter(q);
  if (provider === "demo") return searchDemo(q);
  // auto: prefer real providers when configured, fall back to demo data
  if (process.env.APOLLO_API_KEY) return searchApollo(q);
  if (process.env.HUNTER_API_KEY) return searchHunter(q);
  return searchDemo(q);
}
