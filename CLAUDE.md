# Outreach — cold email + CRM

Owner: Kateryna (non-technical — explain things simply, give copy-paste
commands one at a time, and prefer point-and-click over terminal when possible).

## What this is

A self-hosted cold-outreach tool built July 2026 in a Claude Code session:
lead search → personalized campaigns → Gmail sending → reply tracking → CRM
pipeline (New → Contacted → Replied → Meeting → Won/Lost).

## Stack & architecture

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4
- All pages are client components fetching JSON from `app/api/*` route handlers
- Storage (`lib/db.ts`): Postgres via a single `q()` helper.
  - `DATABASE_URL` set → Neon serverless Postgres over HTTPS (persistent)
  - unset → embedded PGlite in `./data/pg` (zero-config local / ephemeral on Vercel)
  - Schema auto-creates on first request (`CREATE TABLE IF NOT EXISTS`)
- Lead providers (`lib/providers/`): Apollo.io, Hunter.io, and a demo generator
  (fake leads on reserved `.example` domains, safe to "send" to)
- Email (`lib/gmail.ts`): SMTP send + IMAP reply-scan via Gmail app password
- Auth (`proxy.ts`): HTTP Basic Auth on everything when `APP_PASSWORD` is set

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
  mode until `GMAIL_USER` + `GMAIL_APP_PASSWORD` are set
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
the API routes (search → import → campaign → send simulated → stats), or drive
the UI with Playwright (chromium). Send flow without Gmail creds records
messages with status "simulated" — that's expected, not a bug.
