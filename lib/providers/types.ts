export interface SearchQuery {
  role: string;
  company: string; // company type / industry keywords
  city: string;
  limit?: number;
}

export interface FoundLead {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company: string;
  city: string;
  source: "apollo" | "hunter" | "demo";
}

export interface SearchResult {
  provider: string;
  demo: boolean;
  note?: string;
  leads: FoundLead[];
}
