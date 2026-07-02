"use client";

import { useEffect, useState } from "react";
import { Card, Banner, btn, input } from "@/components/ui";

interface Settings {
  profile: { name: string; email: string };
  gmail: boolean;
  gmailUser: string | null;
  gmailSource: "profile" | "server" | null;
  gmailForm: { user: string; fromName: string; passwordSet: boolean };
  apollo: { configured: boolean; source: "profile" | "server" | null };
  hunter: { configured: boolean; source: "profile" | "server" | null };
  persistentDb: boolean;
  demoDeployment: boolean;
}

function Chip({ tone, children }: { tone: "on" | "default" | "off"; children: React.ReactNode }) {
  const styles = {
    on: "bg-emerald-50 text-emerald-700",
    default: "bg-blue-50 text-blue-700",
    off: "bg-slate-100 text-slate-500",
  }[tone];
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

function SourceChip({ configured, source }: { configured: boolean; source: "profile" | "server" | null }) {
  if (!configured) return <Chip tone="off">Not configured</Chip>;
  return source === "profile" ? (
    <Chip tone="on">Configured — your key</Chip>
  ) : (
    <Chip tone="default">Using server default</Chip>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // form state
  const [name, setName] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [gmailFromName, setGmailFromName] = useState("");
  const [apolloKey, setApolloKey] = useState("");
  const [hunterKey, setHunterKey] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  function apply(data: Settings) {
    setS(data);
    setName(data.profile.name);
    setGmailUser(data.gmailForm.user);
    setGmailFromName(data.gmailForm.fromName);
    setGmailPassword("");
    setApolloKey("");
    setHunterKey("");
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(apply)
      .catch(() => {});
  }, []);

  function ok(text: string) {
    setFlash({ tone: "success", text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(section: string, patch: Record<string, string>, doneMsg: string) {
    setSaving(section);
    setFlash(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Saving failed");
      apply(data);
      ok(doneMsg);
    } catch (e) {
      setFlash({ tone: "error", text: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      setFlash({ tone: "error", text: "New passwords don't match — please re-type them." });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving("password");
    setFlash(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: pwCurrent, next: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Changing the password failed");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      ok("Password changed. Other devices were signed out.");
    } catch (e) {
      setFlash({ tone: "error", text: (e as Error).message });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(null);
    }
  }

  const gmailChip = !s ? null : s.gmail ? (
    s.gmailSource === "profile" ? (
      <Chip tone="on">Connected — your Gmail</Chip>
    ) : (
      <Chip tone="default">Using server default</Chip>
    )
  ) : (
    <Chip tone="off">Not connected</Chip>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-slate-600">
        Everything on this page belongs to <strong>your profile</strong> — each person who signs
        in has their own leads, campaigns, Gmail connection and API keys.
      </p>

      {flash && <Banner tone={flash.tone}>{flash.text}</Banner>}

      {s?.demoDeployment && (
        <Banner tone="warn">
          This is a hosted demo deployment without a DATABASE_URL: the database is ephemeral and
          resets periodically. Add a Neon Postgres DATABASE_URL for permanent storage.
        </Banner>
      )}

      <Card>
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Your name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Used as the sender name on emails when no &quot;From name&quot; is set below.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email (sign-in)</label>
            <input className={`${input} bg-slate-50 text-slate-500`} value={s?.profile.email ?? ""} readOnly />
          </div>
        </div>
        <div className="mt-4">
          <button
            className={btn.primary}
            disabled={saving === "profile" || !name.trim()}
            onClick={() => save("profile", { name }, "Profile saved.")}
          >
            {saving === "profile" ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Current password</label>
            <input className={input} type="password" autoComplete="current-password" required value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">New password</label>
            <input className={input} type="password" autoComplete="new-password" required minLength={8} value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Repeat new password</label>
            <input className={input} type="password" autoComplete="new-password" required value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={btn.secondary} disabled={saving === "password"}>
              {saving === "password" ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Email sending (Gmail / Google Workspace)</h2>
          {gmailChip}
        </div>
        {s?.gmail && s.gmailUser && (
          <p className="mt-1 text-sm text-slate-500">Sending as {s.gmailUser}</p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Connect your own Gmail so campaigns are sent from your address and replies land back in
          your pipeline. Until connected, sends run as a <strong>dry run</strong> — messages are
          logged in the CRM but no email is sent.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Gmail address</label>
            <input className={input} type="email" value={gmailUser} onChange={(e) => setGmailUser(e.target.value)} placeholder="you@yourcompany.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">App password</label>
            <input
              className={input}
              type="password"
              value={gmailPassword}
              onChange={(e) => setGmailPassword(e.target.value)}
              placeholder={s?.gmailForm.passwordSet ? "•••• saved — type to replace" : "xxxx xxxx xxxx xxxx"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">From name (optional)</label>
            <input className={input} value={gmailFromName} onChange={(e) => setGmailFromName(e.target.value)} placeholder="Your Name" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className={btn.primary}
            disabled={saving === "gmail"}
            onClick={() =>
              save(
                "gmail",
                {
                  gmailUser,
                  gmailFromName,
                  ...(gmailPassword ? { gmailAppPassword: gmailPassword } : {}),
                },
                "Gmail settings saved."
              )
            }
          >
            {saving === "gmail" ? "Saving…" : "Save Gmail settings"}
          </button>
          {(s?.gmailForm.user || s?.gmailForm.passwordSet) && (
            <button
              className={btn.danger}
              disabled={saving === "gmail"}
              onClick={() =>
                save(
                  "gmail",
                  { gmailUser: "", gmailAppPassword: "", gmailFromName: "" },
                  "Gmail disconnected from your profile."
                )
              }
            >
              Disconnect
            </button>
          )}
        </div>
        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            How to get a Gmail app password
          </summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Make sure 2-Step Verification is enabled on your Google account (app passwords require it).</li>
            <li>
              Go to{" "}
              <a className="text-indigo-600 underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
                myaccount.google.com/apppasswords
              </a>{" "}
              and create an app password named &quot;Outreach&quot;.
            </li>
            <li>Paste your address and the 16-character password above and save.</li>
          </ol>
        </details>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Apollo.io lead search</h2>
          {s && <SourceChip configured={s.apollo.configured} source={s.apollo.source} />}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Best coverage for role + location + company-type searches. Create an API key at
          apollo.io (Settings → Integrations → API) and paste it here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${input} sm:max-w-sm`}
            type="password"
            value={apolloKey}
            onChange={(e) => setApolloKey(e.target.value)}
            placeholder={s?.apollo.source === "profile" ? "•••• saved — type to replace" : "Apollo API key"}
          />
          <button
            className={btn.primary}
            disabled={saving === "apollo" || !apolloKey}
            onClick={() => save("apollo", { apolloApiKey: apolloKey }, "Apollo key saved.")}
          >
            Save
          </button>
          {s?.apollo.source === "profile" && (
            <button
              className={btn.danger}
              disabled={saving === "apollo"}
              onClick={() => save("apollo", { apolloApiKey: "" }, "Apollo key removed.")}
            >
              Remove
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Hunter.io lead search</h2>
          {s && <SourceChip configured={s.hunter.configured} source={s.hunter.source} />}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Alternative provider (domain-first). Get an API key at hunter.io/api-keys and paste it
          here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${input} sm:max-w-sm`}
            type="password"
            value={hunterKey}
            onChange={(e) => setHunterKey(e.target.value)}
            placeholder={s?.hunter.source === "profile" ? "•••• saved — type to replace" : "Hunter API key"}
          />
          <button
            className={btn.primary}
            disabled={saving === "hunter" || !hunterKey}
            onClick={() => save("hunter", { hunterApiKey: hunterKey }, "Hunter key saved.")}
          >
            Save
          </button>
          {s?.hunter.source === "profile" && (
            <button
              className={btn.danger}
              disabled={saving === "hunter"}
              onClick={() => save("hunter", { hunterApiKey: "" }, "Hunter key removed.")}
            >
              Remove
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Demo data</h2>
          <Chip tone="on">Always available</Chip>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Generates realistic sample leads whose addresses end in <code>.example</code> — a
          reserved domain — so demo sends can never reach a real person.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Database</h2>
          {s &&
            (s.persistentDb ? (
              <Chip tone="on">Cloud Postgres (persistent)</Chip>
            ) : (
              <Chip tone="off">Local embedded database</Chip>
            ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Shared by all profiles on this deployment (each profile only ever sees its own data).
          Set <code>DATABASE_URL</code> to a free{" "}
          <a className="text-indigo-600 underline" href="https://neon.tech" target="_blank" rel="noreferrer">
            Neon
          </a>{" "}
          Postgres connection string for persistent cloud storage.
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
