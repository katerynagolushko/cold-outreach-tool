import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

/**
 * Gmail / Google Workspace integration via app password.
 * Credentials are per-profile (saved in Settings, with the GMAIL_* env vars
 * as server-wide fallback) and are passed in by the caller — see
 * lib/user-settings.ts `effectiveCreds`.
 */
export interface GmailCreds {
  user: string;
  pass: string;
  fromName?: string;
}

export function gmailConfigured(creds: GmailCreds): boolean {
  return Boolean(creds.user && creds.pass);
}

export async function sendEmail(
  creds: GmailCreds,
  opts: {
    to: string;
    subject: string;
    text: string;
  }
): Promise<{ messageId: string }> {
  if (!gmailConfigured(creds)) throw new Error("Gmail is not configured");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });
  const info = await transporter.sendMail({
    from: creds.fromName ? `"${creds.fromName}" <${creds.user}>` : creds.user,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  return { messageId: info.messageId };
}

export interface InboxReply {
  fromEmail: string;
  subject: string;
  receivedAt: Date;
  uid: string;
}

/**
 * Scan the Gmail inbox over IMAP for messages from any of the given
 * addresses received since `since`. Used to detect lead replies.
 */
export async function findRepliesFrom(
  creds: GmailCreds,
  emails: string[],
  since: Date
): Promise<InboxReply[]> {
  if (!gmailConfigured(creds)) throw new Error("Gmail is not configured");
  if (emails.length === 0) return [];

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    logger: false,
  });

  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const replies: InboxReply[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      if (uids && uids.length > 0) {
        for await (const msg of client.fetch(
          uids,
          { envelope: true, uid: true },
          { uid: true }
        )) {
          const from = msg.envelope?.from?.[0]?.address?.toLowerCase();
          if (from && wanted.has(from)) {
            replies.push({
              fromEmail: from,
              subject: msg.envelope?.subject ?? "",
              receivedAt: msg.envelope?.date ?? new Date(),
              uid: String(msg.uid),
            });
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }
  return replies;
}
