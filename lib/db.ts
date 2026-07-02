import path from "path";
import fs from "fs";

export type Stage = "new" | "contacted" | "replied" | "meeting" | "won" | "lost";
export const STAGES: Stage[] = ["new", "contacted", "replied", "meeting", "won", "lost"];
export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  won: "Won",
  lost: "Lost",
};

export interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company: string;
  city: string;
  source: string;
  stage: Stage;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
}

export type Row = Record<string, unknown>;
type Exec = (text: string, params?: unknown[]) => Promise<Row[]>;

/**
 * Storage backends, chosen by DATABASE_URL:
 *  - postgresql://... → Neon serverless Postgres over HTTPS (persistent, for
 *    hosted deployments; also usable locally to share one database).
 *  - unset → PGlite, an embedded Postgres stored in ./data/pg (zero-config
 *    local use). On Vercel without DATABASE_URL it falls back to /tmp
 *    (ephemeral demo mode).
 * Both speak real Postgres, so every query below has a single dialect.
 */
let execPromise: Promise<Exec> | null = null;

async function createExec(): Promise<Exec> {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres/i.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    return async (text, params) => (await sql.query(text, (params ?? []) as never)) as Row[];
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.VERCEL
    ? "/tmp/outreach-pg"
    : path.join(process.cwd(), "data", "pg");
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  return async (text, params) => (await db.query(text, params ?? [])).rows as Row[];
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gmail_user TEXT NOT NULL DEFAULT '',
  gmail_app_password TEXT NOT NULL DEFAULT '',
  gmail_from_name TEXT NOT NULL DEFAULT '',
  apollo_api_key TEXT NOT NULL DEFAULT '',
  hunter_api_key TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS leads (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  stage TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id INT REFERENCES campaigns(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  gmail_message_id TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS replies (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL,
  imap_uid TEXT NOT NULL,
  UNIQUE(lead_id, imap_uid)
);
CREATE TABLE IF NOT EXISTS activities (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS leads_user_email_key ON leads (user_id, email);
CREATE INDEX IF NOT EXISTS leads_user_idx ON leads (user_id);
CREATE INDEX IF NOT EXISTS campaigns_user_idx ON campaigns (user_id);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
`;

async function getExec(): Promise<Exec> {
  if (!execPromise) {
    execPromise = (async () => {
      const exec = await createExec();
      for (const stmt of SCHEMA.split(";")) {
        if (stmt.trim()) await exec(stmt);
      }
      return exec;
    })().catch((e) => {
      execPromise = null; // allow retry on next request
      throw e;
    });
  }
  return execPromise;
}

/** Run a query and return its rows. Placeholders are Postgres-style $1, $2… */
export async function q<T = Row>(text: string, params?: unknown[]): Promise<T[]> {
  const exec = await getExec();
  return (await exec(text, params)) as T[];
}

/** Run a query and return the first row (or null). */
export async function one<T = Row>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function addActivity(
  leadId: number,
  type: "note" | "stage_change" | "email_sent" | "reply" | "created",
  content: string
): Promise<void> {
  await q("INSERT INTO activities (lead_id, type, content) VALUES ($1, $2, $3)", [
    leadId,
    type,
    content,
  ]);
}

export async function setStage(leadId: number, stage: Stage): Promise<void> {
  const lead = await one<{ stage: Stage }>("SELECT stage FROM leads WHERE id = $1", [leadId]);
  if (!lead || lead.stage === stage) return;
  await q("UPDATE leads SET stage = $1, updated_at = now() WHERE id = $2", [stage, leadId]);
  await addActivity(leadId, "stage_change", `${STAGE_LABELS[lead.stage]} → ${STAGE_LABELS[stage]}`);
}

/** to_char format used everywhere a timestamp is shown in the UI. */
export const TS = "YYYY-MM-DD HH24:MI";
