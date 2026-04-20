import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncUserCalendar } from "@/lib/google/calendar-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs every few hours (Vercel cron). For each connected Google Calendar
 * integration with sync_enabled, pushes upcoming non-done tasks as events.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "service_role_key_missing" },
      { status: 503 }
    );
  }

  const { data: integrations } = await admin
    .from("calendar_integrations")
    .select("id")
    .eq("provider", "google")
    .eq("sync_enabled", true);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const results: { id: string; synced: number }[] = [];
  for (const row of integrations ?? []) {
    try {
      const res = await syncUserCalendar(row.id, appUrl);
      results.push({ id: row.id, synced: res.synced });
    } catch (e) {
      console.error("sync integration failed", row.id, e);
    }
  }

  return NextResponse.json({ ok: true, integrations: results });
}
