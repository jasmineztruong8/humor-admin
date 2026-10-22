import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Last hop of the flow: admin -> Google -> Supabase -> here.
// Supabase sends back a one-time code; we swap it for a session cookie.
// Always redirects to a fixed path on our own origin (never one taken from
// the request), and proxy.ts decides from there whether this user is allowed.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
