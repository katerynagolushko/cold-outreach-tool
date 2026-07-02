import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * At-rest encryption for the secrets users save in Settings (Gmail app
 * password, provider API keys). AES-256-GCM keyed from AUTH_SECRET
 * (recommended for hosted deployments) or APP_PASSWORD as a fallback.
 * With neither set, values are stored as-is — acceptable for a local,
 * single-user install.
 *
 * If the encryption secret changes, previously saved values can no longer
 * be decrypted; they are treated as "not set" and can simply be re-entered
 * in Settings (nothing precious is lost).
 */

const PREFIX = "v1:";

function key(): Buffer | null {
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptionEnabled(): boolean {
  return key() !== null;
}

export function sealSecret(plain: string): string {
  const k = key();
  if (!plain || !k) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${ct.toString("base64")}:${cipher
    .getAuthTag()
    .toString("base64")}`;
}

export function openSecret(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored; // saved before encryption was enabled
  const k = key();
  if (!k) return "";
  try {
    const [, iv, ct, tag] = stored.split(":");
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return ""; // encryption secret changed — treat as not set
  }
}
