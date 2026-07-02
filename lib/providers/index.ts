import { searchApollo } from "./apollo";
import { searchHunter } from "./hunter";
import { searchDemo } from "./demo";
import type { SearchQuery, SearchResult } from "./types";

export type ProviderName = "auto" | "apollo" | "hunter" | "demo";

/** API keys are per-profile (Settings), with env vars as server fallback —
 *  resolved by the caller via lib/user-settings.ts `effectiveCreds`. */
export interface ProviderKeys {
  apollo?: string;
  hunter?: string;
}

export function availableProviders(keys: ProviderKeys) {
  return {
    apollo: Boolean(keys.apollo),
    hunter: Boolean(keys.hunter),
    demo: true,
  };
}

export async function searchLeads(
  q: SearchQuery,
  provider: ProviderName = "auto",
  keys: ProviderKeys = {}
): Promise<SearchResult> {
  if (provider === "apollo") return searchApollo(q, keys.apollo);
  if (provider === "hunter") return searchHunter(q, keys.hunter);
  if (provider === "demo") return searchDemo(q);
  // auto: prefer real providers when configured, fall back to demo data
  if (keys.apollo) return searchApollo(q, keys.apollo);
  if (keys.hunter) return searchHunter(q, keys.hunter);
  return searchDemo(q);
}
