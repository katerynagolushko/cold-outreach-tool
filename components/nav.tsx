"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/search", label: "Lead Search" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/settings", label: "Settings" },
];

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="inline-block h-6 w-6 rounded-md bg-indigo-600 text-center text-sm font-bold leading-6 text-white">
        O
      </span>
      Outreach
    </span>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/signup";
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (authPage) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
        else window.location.href = "/login"; // cookie present but session expired
      })
      .catch(() => {});
  }, [authPage]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  if (authPage) {
    return (
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Brand />
        </div>
      </header>
    );
  }

  const initials =
    (user?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "•";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/">
          <Brand />
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <Link
              href="/settings"
              title={user.email}
              className="hidden items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 sm:flex"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials}
              </span>
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-700">
                {user.name}
              </span>
            </Link>
          )}
          <button
            onClick={signOut}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
