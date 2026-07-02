import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

/**
 * Gmail / Google Workspace integration via app password.
 * Configure:
 *   GMAIL_USER          your corporate address, e.g. you@yourcompany.com
 *   GMAIL_APP_PASSWORD  16-char app password (myaccount.google.com/apppasswords)
 *   GMAIL_FROM_NAME     optional display name
 */
export function gmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ messageId: string }> {
  if (!gmailConfigured()) throw new Error("Gmail is not configured");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  const info = await transporter.sendMail({
    from: process.env.GMAIL_FROM_NAME
      ? `"${process.env.GMAIL_FROM_NAME}" <${process.env.GMAIL_USER}>`
      : process.env.GMAIL_USER,
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
  emails: string[],
  since: Date
): Promise<InboxReply[]> {
  if (!gmailConfigured()) throw new Error("Gmail is not configured");
  if (emails.length === 0) return [];

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
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
