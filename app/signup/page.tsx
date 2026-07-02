"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Banner, btn, input } from "@/components/ui";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [invite, setInvite] = useState("");
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) window.location.href = "/";
        else setInviteRequired(Boolean(d.inviteRequired));
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match — please re-type them.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, invite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-up failed");
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your leads, campaigns and settings are private to your profile.
        </p>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Your name</label>
            <input
              className={input}
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kateryna Golushko"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
            <input
              className={input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Password <span className="font-normal">(at least 8 characters)</span>
            </label>
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Repeat password</label>
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {inviteRequired && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Invite code</label>
              <input
                className={input}
                required
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="Ask the site owner for the code"
              />
              <p className="mt-1 text-xs text-slate-500">
                This site is invite-only. The invite code is the site&apos;s APP_PASSWORD.
              </p>
            </div>
          )}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full justify-center`}>
            {busy ? "Creating profile…" : "Create profile"}
          </button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-600">
        Already have a profile?{" "}
        <Link href="/login" className="font-medium text-indigo-600 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
