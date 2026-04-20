import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { googleAuthUrl, googleOauthEnabled } from "@/lib/google/oauth";

export async function GET(request: Request) {
  if (!googleOauthEnabled()) {
    return NextResponse.json(
      { error: "Google OAuth not configured on server" },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/calendar/google/callback`;
  const state = `${user.id}.${Math.random().toString(36).slice(2)}`;
  const url = googleAuthUrl(state, redirectUri);

  return NextResponse.redirect(url);
}
