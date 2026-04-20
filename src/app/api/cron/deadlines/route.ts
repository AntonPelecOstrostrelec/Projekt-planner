import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify/email";
import { sendPushToUser } from "@/lib/notify/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Runs hourly (Vercel cron). Inspects open tasks with deadlines and emits
 * in-app notifications at the 72h, 24h, and overdue thresholds — each kind
 * at most once per task, deduplicated via public.scheduled_alerts.
 *
 * Auth: header "Authorization: Bearer <CRON_SECRET>". Vercel sets this
 * automatically when a cron is triggered, or the operator can set the
 * same secret to call this manually.
 */

type AssigneeRow = { user_id: string };

type TaskRow = {
  id: string;
  title: string;
  project_id: string;
  workspace_id: string;
  status: string;
  deadline: string;
  task_assignees: AssigneeRow[] | null;
  projects: { name: string; created_by: string | null } | { name: string; created_by: string | null }[] | null;
  created_by: string | null;
};

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

  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 3600 * 1000);

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(
      "id, title, project_id, workspace_id, status, deadline, created_by, task_assignees(user_id), projects(name, created_by)"
    )
    .not("deadline", "is", null)
    .neq("status", "done")
    .lte("deadline", in72h.toISOString())
    .returns<TaskRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  let notifCount = 0;

  for (const t of tasks ?? []) {
    const deadline = new Date(t.deadline);
    const hoursUntil = (deadline.getTime() - now.getTime()) / (3600 * 1000);

    let kind: "deadline_72h" | "deadline_24h" | "deadline_overdue" | null = null;
    let alertKind: "deadline_72h" | "deadline_24h" | "overdue" | null = null;

    if (hoursUntil < 0) {
      kind = "deadline_overdue";
      alertKind = "overdue";
    } else if (hoursUntil <= 24) {
      kind = "deadline_24h";
      alertKind = "deadline_24h";
    } else if (hoursUntil <= 72) {
      kind = "deadline_72h";
      alertKind = "deadline_72h";
    }

    if (!kind || !alertKind) continue;

    // Dedup check
    const { data: existing } = await admin
      .from("scheduled_alerts")
      .select("task_id")
      .eq("task_id", t.id)
      .eq("kind", alertKind)
      .maybeSingle();

    if (existing) continue;

    // Recipients: assignees + project creator + task creator (deduped)
    const recipientIds = new Set<string>();
    for (const a of t.task_assignees ?? []) recipientIds.add(a.user_id);
    if (t.created_by) recipientIds.add(t.created_by);
    const projectMeta = Array.isArray(t.projects) ? t.projects[0] : t.projects;
    if (projectMeta?.created_by) recipientIds.add(projectMeta.created_by);

    if (recipientIds.size === 0) {
      // Fall back to all workspace members so something gets through
      const { data: members } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", t.workspace_id);
      for (const m of members ?? []) recipientIds.add(m.user_id);
    }

    const title =
      kind === "deadline_overdue"
        ? `⚠️ Meškáš: ${t.title}`
        : kind === "deadline_24h"
          ? `⏰ Do 24h: ${t.title}`
          : `⏱️ O 3 dni: ${t.title}`;

    const body =
      kind === "deadline_overdue"
        ? `Deadline bol ${deadline.toLocaleString("sk-SK")}. Čo s tým?`
        : `Deadline ${deadline.toLocaleString("sk-SK")}. Pohni sa.`;

    const url = `${appUrl}/w/${t.workspace_id}/projects/${t.project_id}`;

    for (const userId of recipientIds) {
      const { error: notifErr } = await admin.from("notifications").insert({
        user_id: userId,
        workspace_id: t.workspace_id,
        kind,
        title,
        body,
        entity_type: "task",
        entity_id: t.id,
        url,
      });
      if (notifErr) continue;
      notifCount++;

      // Fan out to email + push if the user opted in for this workspace.
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select("email_enabled, push_enabled, deadline_alerts")
        .eq("user_id", userId)
        .eq("workspace_id", t.workspace_id)
        .maybeSingle();

      const wantsDeadline = prefs?.deadline_alerts ?? true;
      if (!wantsDeadline) continue;

      if (prefs?.email_enabled ?? true) {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.email) {
          await sendEmail({
            to: profile.email,
            subject: title,
            text: `${body}\n\n${url}`,
            html: `<p>${body}</p><p><a href="${url}">Otvoriť v Pushnik</a></p>`,
          });
        }
      }

      if (prefs?.push_enabled) {
        await sendPushToUser(userId, { title, body, url });
      }
    }

    await admin
      .from("scheduled_alerts")
      .insert({ task_id: t.id, kind: alertKind });
  }

  return NextResponse.json({
    ok: true,
    processed: tasks?.length ?? 0,
    notifications: notifCount,
  });
}
