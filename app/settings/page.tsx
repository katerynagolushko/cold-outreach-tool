"use client";

import { useEffect, useState } from "react";
import { Card, Banner } from "@/components/ui";

interface Settings {
  providers: { apollo: boolean; hunter: boolean; demo: boolean };
  gmail: boolean;
  gmailUser: string | null;
  persistentDb: boolean;
  demoDeployment: boolean;
}

function Status({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Configured
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      Not configured
    </span>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setS);
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-slate-600">
        Integrations are configured with environment variables (in <code>.env.local</code> locally,
        or the Vercel project settings when deployed). No secrets are ever stored in the database.
      </p>

      {s?.demoDeployment && (
        <Banner tone="warn">
          This is a hosted demo deployment without a DATABASE_URL: the database is ephemeral and
          resets periodically. Add a Neon Postgres DATABASE_URL for permanent storage.
        </Banner>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Database</h2>
          {s &&
            (s.persistentDb ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Cloud Postgres (persistent)
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Local embedded database
              </span>
            ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Without configuration, data is stored in a local embedded Postgres (in{" "}
          <code>./data/pg</code>). Set <code>DATABASE_URL</code> to a free{" "}
          <a className="text-indigo-600 underline" href="https://neon.tech" target="_blank" rel="noreferrer">
            Neon
          </a>{" "}
          Postgres connection string to store data in the cloud — required for persistent hosted
          deployments, and it lets your local app and the hosted app share the same data.
        </p>
        <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">DATABASE_URL=postgresql://user:pass@host/db?sslmode=require</pre>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Gmail / Google Workspace sending</h2>
          <Status ok={Boolean(s?.gmail)} />
        </div>
        {s?.gmail && s.gmailUser && (
          <p className="mt-1 text-sm text-slate-500">Sending as {s.gmailUser}</p>
        )}
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>
            Make sure 2-Step Verification is enabled on your Google Workspace account (app
            passwords require it).
          </li>
          <li>
            Go to{" "}
            <a
              className="text-indigo-600 underline"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              myaccount.google.com/apppasswords
            </a>{" "}
            and create an app password named &quot;Outreach&quot;.
          </li>
          <li>
            Set the environment variables:
            <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`GMAIL_USER=you@yourcompany.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
GMAIL_FROM_NAME=Your Name`}
            </pre>
          </li>
          <li>Restart the app. Sending and reply tracking (IMAP) will switch on automatically.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Until configured, campaign sends run as a <strong>dry run</strong> — messages are logged
          in the CRM but no email leaves your machine.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Apollo.io lead search</h2>
          <Status ok={Boolean(s?.providers.apollo)} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Best coverage for role + location + company-type searches. Create an API key at
          apollo.io (Settings → Integrations → API), then set:
        </p>
        <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">APOLLO_API_KEY=...</pre>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Hunter.io lead search</h2>
          <Status ok={Boolean(s?.providers.hunter)} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Alternative provider (domain-first). Get an API key at hunter.io/api-keys, then set:
        </p>
        <pre className="mt-2 rounded-lg bg-slate-900 p-3 text-xs text-slate-100">HUNTER_API_KEY=...</pre>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Demo data</h2>
          <Status ok={true} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Always available. Generates realistic sample leads whose addresses end in{" "}
          <code>.example</code> — a reserved domain — so demo sends can never reach a real person.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">A note on cold email compliance</h2>
        <p className="mt-2 text-sm text-slate-600">
          B2B cold outreach is legal in most places when done right: identify yourself and your
          company truthfully, make the message relevant to the recipient&apos;s role, honour
          opt-outs immediately, and keep volumes modest (the built-in delay between sends helps).
          If you target the EU/UK, review PECR/GDPR legitimate-interest requirements for your
          case.
        </p>
      </Card>
    </div>
  );
}
