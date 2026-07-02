/**
 * Shared between lib/auth.ts (node runtime) and proxy.ts (edge runtime).
 * Keep this module dependency-free so the proxy can import it.
 */
export const SESSION_COOKIE = "outreach_session";
