import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Sign-in gate. Everything except the login/signup pages and the auth API
 * requires a session cookie: pages redirect to /login, API calls get a 401.
 *
 * This only checks that the cookie exists (the edge runtime can't reach the
 * database) — every API route validates the session for real via
 * lib/auth.ts `currentUser`.
 */

const PUBLIC_PAGES = new Set(["/login", "/signup"]);

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PAGES.has(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (req.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
