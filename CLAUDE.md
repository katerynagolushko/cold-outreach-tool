# Outreach — cold email + CRM

Owner: Kateryna (non-technical — explain things simply, give copy-paste
commands one at a time, and prefer point-and-click over terminal when possible).

## What this is

A self-hosted cold-outreach tool built July 2026 in a Claude Code session:
lead search → personalized campaigns → Gmail sending → reply tracking → CRM
pipeline (New → Contacted → Replied → Meeting → Won/Lost). Multi-user since
July 2026: each profile (user account) has its own private leads, campaigns,
Gmail connection and API keys.

## Stack & architecture

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4
- All pages are client components fetching JSON from `app/api/*` route handlers
- Storage (`lib/db.ts`): Postgres via a single `q()` helper.
  - `DATABASE_URL` set → Neon serverless Postgres over HTTPS (persistent)
  - unset → embedded PGlite in `./data/pg` (zero-config local / ephemeral on Vercel)
  - Schema auto-creates on first request (`CREATE TABLE IF NOT EXISTS` +
    idempotent `ALTER TABLE` migrations for pre-profile databases)
- Auth (`lib/auth.ts` + `proxy.ts`): email/password accounts (`users` table,
  scrypt hashes), 30-day sessions (`sessions` table stores a SHA-256 of the
  random token held in the httpOnly `outreach_session` cookie). The proxy only
  checks cookie presence (pages → redirect to /login, APIs → 401); every API
  route re-validates via `currentUser()` and scopes queries by `user_id`
  (leads + campaigns carry `user_id`; messages/replies/activities inherit
  scope through their lead).
  - `APP_PASSWORD` is now the **invite code** checked by /api/auth/signup
    (no longer HTTP Basic Auth). No password-reset flow exists — if a password
    is forgotten, update `users.password_hash` directly in the DB.
  - The first profile ever created adopts all pre-profile rows
    (`user_id IS NULL`), so the upgraded install keeps its data.
- Per-profile settings (`lib/user-settings.ts`, `user_settings` table): Gmail
  creds + Apollo/Hunter keys per user, encrypted at rest by `lib/secrets.ts`
  (AES-256-GCM keyed from `AUTH_SECRET`, falling back to `APP_PASSWORD`;
  plaintext if neither is set). Env vars (`GMAIL_*`, `*_API_KEY`) remain
  server-wide fallbacks for profiles that haven't saved their own.
- Lead providers (`lib/providers/`): Apollo.io, Hunter.io, and a demo generator
  (fake leads on reserved `.example` domains, safe to "send" to); API keys are
  passed in per user
- Email (`lib/gmail.ts`): SMTP send + IMAP reply-scan via Gmail app password;
  credentials passed in per user

## Deployment state (as of July 2026)

- GitHub: `katerynagolushko/cold-outreach-tool` (private), pushed via GitHub Desktop
- Vercel: project `cold-outreach-tool`, team "Kateryna Golushko's projects",
  auto-deploys from main. Live at cold-outreach-tool.vercel.app
- Vercel env vars set: `HUNTER_API_KEY`, `APP_PASSWORD`, `DATABASE_URL` (Neon,
  eu-west-2). Local `.env.local` (never committed) has the same plus
  `APOLLO_API_KEY`.
- Local copy lives at `~/Downloads/outreach` on Kateryna's MacBook; local and
  hosted share the same Neon database.

## Known state & quirks

- Apollo key exists but the free plan blocks the people-search API (403
  API_INACCESSIBLE) — searches should use Hunter until/unless Apollo is upgraded
- Gmail is NOT yet configured — campaign sends run in "simulated" (dry-run)
  mode until Gmail is connected in Settings (or `GMAIL_USER` +
  `GMAIL_APP_PASSWORD` env vars are set as server-wide fallback)
- `.env.local` may contain a harmless duplicated `DATABASE_URL` line
- Hunter free tier: ~25 searches/month; results are company-first and
  role-matching is loose

## Likely next features (discussed, not built)

- Follow-up sequences ("no reply in N days → send template #2")
- Gmail OAuth as an alternative to app passwords
- Unsubscribe link / suppression list
- Reply-content snippets (currently only subject + date are stored)

## Testing

No test suite. Verify changes by: `npm run build`, then `npm start` and curl
the API routes (signup → search → import → campaign → send simulated → stats),
or drive the UI with Playwright (chromium). All data routes need a session:
sign up once with `curl -c jar.txt -X POST .../api/auth/signup` (JSON body:
name, email, password, invite if APP_PASSWORD is set) and pass `-b jar.txt`
on later requests. Send flow without Gmail creds records messages with status
"simulated" — that's expected, not a bug.
