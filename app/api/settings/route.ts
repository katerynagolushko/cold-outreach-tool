import { NextResponse } from "next/server";
import { availableProviders } from "@/lib/providers";
import { gmailConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  const persistent = Boolean(
    process.env.DATABASE_URL && /^postgres/i.test(process.env.DATABASE_URL)
  );
  return NextResponse.json({
    providers: availableProviders(),
    gmail: gmailConfigured(),
    gmailUser: process.env.GMAIL_USER
      ? process.env.GMAIL_USER.replace(/^(.).*(@.*)$/, "$1***$2")
      : null,
    persistentDb: persistent,
    demoDeployment: Boolean(process.env.VERCEL) && !persistent,
  });
}
