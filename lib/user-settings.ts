import { one, q } from "./db";
import { openSecret, sealSecret } from "./secrets";

/**
 * Per-profile integration settings (user_settings table). Every user
 * connects their own Gmail and lead-provider keys in Settings; fields left
 * empty fall back to the server-wide environment variables, so a
 * single-user install configured via .env keeps working unchanged.
 */

export interface Creds {
  gmailUser: string;
  gmailAppPassword: string;
  gmailFromName: string;
  apolloApiKey: string;
  hunterApiKey: string;
}

const EMPTY: Creds = {
  gmailUser: "",
  gmailAppPassword: "",
  gmailFromName: "",
  apolloApiKey: "",
  hunterApiKey: "",
};

interface SettingsRow {
  gmail_user: string;
  gmail_app_password: string;
  gmail_from_name: string;
  apollo_api_key: string;
  hunter_api_key: string;
}

/** Exactly what the user saved on their profile (secrets decrypted). */
export async function ownCreds(userId: number): Promise<Creds> {
  const row = await one<SettingsRow>("SELECT * FROM user_settings WHERE user_id = $1", [userId]);
  if (!row) return { ...EMPTY };
  return {
    gmailUser: row.gmail_user,
    gmailAppPassword: openSecret(row.gmail_app_password),
    gmailFromName: row.gmail_from_name,
    apolloApiKey: openSecret(row.apollo_api_key),
    hunterApiKey: openSecret(row.hunter_api_key),
  };
}

/**
 * Credentials actually used for this user: their own settings first, the
 * server environment as fallback. Gmail address + app password fall back
 * as a pair — mixing one user's address with another's password would
 * never authenticate.
 */
export async function effectiveCreds(userId: number): Promise<Creds & { gmailSource: "profile" | "server" | null }> {
  const own = await ownCreds(userId);
  const ownGmail = Boolean(own.gmailUser && own.gmailAppPassword);
  const envGmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  return {
    gmailUser: ownGmail ? own.gmailUser : process.env.GMAIL_USER ?? "",
    gmailAppPassword: ownGmail ? own.gmailAppPassword : process.env.GMAIL_APP_PASSWORD ?? "",
    gmailFromName: ownGmail
      ? own.gmailFromName
      : own.gmailFromName || process.env.GMAIL_FROM_NAME || "",
    gmailSource: ownGmail ? "profile" : envGmail ? "server" : null,
    apolloApiKey: own.apolloApiKey || process.env.APOLLO_API_KEY || "",
    hunterApiKey: own.hunterApiKey || process.env.HUNTER_API_KEY || "",
  };
}

const COLUMNS: Array<{ field: keyof Creds; column: string; secret: boolean }> = [
  { field: "gmailUser", column: "gmail_user", secret: false },
  { field: "gmailAppPassword", column: "gmail_app_password", secret: true },
  { field: "gmailFromName", column: "gmail_from_name", secret: false },
  { field: "apolloApiKey", column: "apollo_api_key", secret: true },
  { field: "hunterApiKey", column: "hunter_api_key", secret: true },
];

/** Save the given fields. Omitted fields stay unchanged; "" clears one. */
export async function saveUserSettings(userId: number, patch: Partial<Creds>): Promise<void> {
  await q(
    "INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [userId]
  );
  for (const { field, column, secret } of COLUMNS) {
    const value = patch[field];
    if (typeof value !== "string") continue;
    const stored = secret ? sealSecret(value.trim()) : value.trim();
    await q(`UPDATE user_settings SET ${column} = $1, updated_at = now() WHERE user_id = $2`, [
      stored,
      userId,
    ]);
  }
}
