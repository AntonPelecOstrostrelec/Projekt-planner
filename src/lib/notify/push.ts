import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
};

let vapidConfigured = false;

export function pushEnabled() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function ensureVapid() {
  if (vapidConfigured || !pushEnabled()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushEnabled()) {
    console.warn("sendPushToUser: VAPID keys missing — skipping");
    return { skipped: true as const };
  }
  ensureVapid();
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  const body = JSON.stringify(payload);
  let sent = 0;

  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        body
      );
      sent++;
    } catch (error) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Endpoint gone — drop the subscription
        await admin.from("push_subscriptions").delete().eq("id", s.id);
      } else {
        console.error("push failed", error);
      }
    }
  }

  return { sent };
}
