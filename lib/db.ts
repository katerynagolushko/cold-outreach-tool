import Database from "better-sqlite3";
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

export interface Message {
  id: number;
  lead_id: number;
  campaign_id: number | null;
  subject: string;
  body: string;
  status: "sent" | "failed" | "simulated";
  gmail_message_id: string | null;
  error: string | null;
  sent_at: string;
}

export interface Reply {
  id: number;
  lead_id: number;
  from_email: string;
  subject: string;
  snippet: string;
  received_at: string;
  imap_uid: string;
}

export interface Activity {
  id: number;
  lead_id: number;
  type: "note" | "stage_change" | "email_sent" | "reply" | "created";
  content: string;
  created_at: string;
}

function dbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (process.env.VERCEL) return "/tmp/outreach.db";
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "outreach.db");
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(dbPath());
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      stage TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      gmail_message_id TEXT,
      error TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_email TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL,
      imap_uid TEXT NOT NULL,
      UNIQUE(lead_id, imap_uid)
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  maybeSeed(_db);
  return _db;
}

export function addActivity(
  db: Database.Database,
  leadId: number,
  type: Activity["type"],
  content: string
) {
  db.prepare("INSERT INTO activities (lead_id, type, content) VALUES (?, ?, ?)").run(
    leadId,
    type,
    content
  );
}

export function setStage(db: Database.Database, leadId: number, stage: Stage) {
  const lead = db.prepare("SELECT stage FROM leads WHERE id = ?").get(leadId) as
    | { stage: Stage }
    | undefined;
  if (!lead || lead.stage === stage) return;
  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?").run(
    stage,
    leadId
  );
  addActivity(db, leadId, "stage_change", `${STAGE_LABELS[lead.stage]} → ${STAGE_LABELS[stage]}`);
}

/** Seed a small demo dataset on hosted demo deployments so the UI isn't empty. */
function maybeSeed(db: Database.Database) {
  if (!process.env.VERCEL && process.env.SEED_DEMO !== "1") return;
  const count = (db.prepare("SELECT COUNT(*) AS c FROM leads").get() as { c: number }).c;
  if (count > 0) return;
  const demo: Array<[string, string, string, string, string, string, Stage]> = [
    ["Amelia", "Clarke", "amelia.clarke@huddlespaces.example", "Event Manager", "Huddle Spaces", "London", "contacted"],
    ["Oliver", "Bennett", "oliver.bennett@thecommondesk.example", "Event Manager", "The Common Desk", "London", "replied"],
    ["Priya", "Sharma", "priya.sharma@nestcowork.example", "Community & Events Lead", "Nest Cowork", "London", "meeting"],
    ["James", "Whitfield", "james.whitfield@forgeworkspace.example", "Head of Events", "Forge Workspace", "London", "new"],
    ["Sofia", "Marchetti", "sofia.marchetti@orbitstudios.example", "Event Manager", "Orbit Studios", "London", "won"],
  ];
  const ins = db.prepare(
    "INSERT INTO leads (first_name, last_name, email, role, company, city, source, stage) VALUES (?, ?, ?, ?, ?, ?, 'demo', ?)"
  );
  for (const d of demo) {
    const r = ins.run(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
    addActivity(db, Number(r.lastInsertRowid), "created", "Imported from demo seed");
  }
}
