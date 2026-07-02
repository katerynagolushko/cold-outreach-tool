# Outreach — cold email + lightweight CRM

Find leads, send personalized cold emails from your own Gmail / Google Workspace
account, and track every lead through a sales pipeline — in one small self-hosted app.

## What it does

1. **Lead search** — enter keywords for role, company type and city
   (e.g. *Event Manager · co-working space · London*) and get back a list of
   names + email addresses. Real data comes from **Apollo.io** or **Hunter.io**
   (bring your own API key); without a key the tool generates clearly-labelled
   **demo leads** (all on the reserved `.example` domain, so nothing can ever
   reach a real inbox) so you can try the whole flow immediately. You can also
   **import your own lead list as CSV** (and export the CRM back to CSV) from
   the Leads page.
2. **Message creation** — write one campaign template; `{{firstName}}`
   (plus `{{company}}`, `{{role}}`, `{{city}}`, `{{lastName}}`) is filled in
   per lead, with a live preview for any recipient.
3. **Sending** — emails go out from **your** Gmail address over SMTP using an
   app password. A short delay between messages keeps you inside Gmail's limits.
   With Gmail unconfigured, sends are **simulated** (dry run) and still logged.
4. **Tracking & CRM** — one click scans your inbox over IMAP and marks leads
   who replied. Every lead moves through a pipeline —
   **New → Contacted → Replied → Meeting → Won / Lost** — on a drag-and-drop
   board, with notes and a full activity history per lead.

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # fill in what you have (everything is optional)
npm run dev                  # open http://localhost:3000
```

The database is a single SQLite file in `./data/` — no external services needed.

## Connecting your Gmail (Google Workspace)

1. Enable **2-Step Verification** on the account (app passwords require it).
2. Create an app password at <https://myaccount.google.com/apppasswords>.
3. In `.env.local`:

   ```
   GMAIL_USER=you@yourcompany.com
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   GMAIL_FROM_NAME=Your Name
   ```

That single credential powers both sending (SMTP) and reply detection (IMAP).
If your Workspace admin has disabled app passwords, ask them to allow
"Less secure apps / app passwords" for your OU, or run the app locally where
you can also use an OAuth-enabled sending tool of your choice.

## Connecting a lead-data provider

| Provider | Env var | Notes |
|---|---|---|
| Apollo.io | `APOLLO_API_KEY` | Best for role + location + company-keyword search. Revealing emails uses Apollo credits. |
| Hunter.io | `HUNTER_API_KEY` | Domain-first: discovers matching companies, then emails per domain. |
| Demo | — | Always on as a fallback; generates safe sample leads. |

## Deploying

Works on Vercel out of the box **as a demo** (the SQLite file lives in `/tmp`,
so data resets between serverless cold starts). For a persistent hosted
deployment, either run it on any small VM (`npm run build && npm start`) where
the SQLite file persists, or point `DATABASE_PATH` at a mounted volume.
Set `APP_PASSWORD` to protect a hosted instance with a password.

## Compliance notes

Cold B2B outreach is legal in most jurisdictions when done properly: identify
yourself truthfully, keep the message relevant to the recipient's role, honour
opt-outs immediately, and keep volumes modest. If you target the EU/UK, review
PECR / GDPR legitimate-interest guidance for your use case.
