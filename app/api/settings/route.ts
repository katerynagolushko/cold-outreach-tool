import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { authRequired, currentUser, type SessionUser } from "@/lib/auth";
import { effectiveCreds, ownCreds, saveUserSettings } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

type Source = "profile" | "server" | null;
const source = (own: string, env: string | undefined): Source =>
  own ? "profile" : env ? "server" : null;

/**
 * Settings are per profile: what the user saved themselves, with the server
 * environment variables as fallback. Secret values are never returned —
 * only whether they are set and where they come from.
 */
async function settingsPayload(user: SessionUser) {
  const own = await ownCreds(user.id);
  const eff = await effectiveCreds(user.id);
  const persistent = Boolean(
    process.env.DATABASE_URL && /^postgres/i.test(process.env.DATABASE_URL)
  );
  return {
    profile: { name: user.name, email: user.email },
    gmail: Boolean(eff.gmailUser && eff.gmailAppPassword),
    gmailUser: eff.gmailUser ? mask(eff.gmailUser) : null,
    gmailSource: eff.gmailSource,
    gmailForm: {
      user: own.gmailUser,
      fromName: own.gmailFromName,
      passwordSet: Boolean(own.gmailAppPassword),
    },
    apollo: { configured: Boolean(eff.apolloApiKey), source: source(own.apolloApiKey, process.env.APOLLO_API_KEY) },
    hunter: { configured: Boolean(eff.hunterApiKey), source: source(own.hunterApiKey, process.env.HUNTER_API_KEY) },
    persistentDb: persistent,
    demoDeployment: Boolean(process.env.VERCEL) && !persistent,
  };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return authRequired();
  return NextResponse.json(await settingsPayload(user));
}

/**
 * Save profile name and/or integration settings.
 * Omitted fields stay unchanged; sending "" clears a field.
 */
export async function PUT(req: NextRequest) {
  let user = await currentUser();
  if (!user) return authRequired();

  const body = await req.json().catch(() => ({}));

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    await q("UPDATE users SET name = $1 WHERE id = $2", [name, user.id]);
    user = { ...user, name };
  }

  await saveUserSettings(user.id, {
    gmailUser: typeof body.gmailUser === "string" ? body.gmailUser : undefined,
    gmailAppPassword: typeof body.gmailAppPassword === "string" ? body.gmailAppPassword : undefined,
    gmailFromName: typeof body.gmailFromName === "string" ? body.gmailFromName : undefined,
    apolloApiKey: typeof body.apolloApiKey === "string" ? body.apolloApiKey : undefined,
    hunterApiKey: typeof body.hunterApiKey === "string" ? body.hunterApiKey : undefined,
  });

  return NextResponse.json(await settingsPayload(user));
}
