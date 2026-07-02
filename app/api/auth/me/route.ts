import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Who is signed in (null if nobody) — public so the login/signup pages can
 *  use it too. inviteRequired tells the signup page to ask for the code. */
export async function GET() {
  return NextResponse.json({
    user: await currentUser(),
    inviteRequired: Boolean(process.env.APP_PASSWORD),
  });
}
