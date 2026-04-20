import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  fetchGoogleUserInfo,
  googleOauthEnabled,
} from "@/lib/google/oauth";

export async function GET(request: Request) {
  if (!googleOauthEnabled()) {
    return NextResponse.redirect(new URL("/?error=google_disabled", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?calendar_error=${encodeURIComponent(error ?? "no_code")}`, url.origin)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${origin}/api/calendar/google/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri);
    const info = await fetchGoogleUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase.from("calendar_integrations").upsert(
      {
        user_id: user.id,
        provider: "google",
        account_email: info.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt.toISOString(),
        calendar_id: "primary",
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    return NextResponse.redirect(new URL("/?calendar_connected=1", origin));
  } catch (e) {
    console.error("Google callback failed", e);
    return NextResponse.redirect(
      new URL(`/?calendar_error=exchange_failed`, origin)
    );
  }
}
