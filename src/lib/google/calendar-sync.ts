import { refreshAccessToken } from "@/lib/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

type Integration = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string | null;
  sync_enabled: boolean;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  project_id: string;
  workspace_id: string;
  projects: { name: string } | { name: string }[] | null;
};

async function ensureFreshToken(integration: Integration) {
  if (
    integration.expires_at &&
    new Date(integration.expires_at).getTime() > Date.now() + 60_000
  ) {
    return integration.access_token;
  }
  if (!integration.refresh_token) {
    throw new Error("Refresh token missing, user must reconnect");
  }
  const tokens = await refreshAccessToken(integration.refresh_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const admin = createAdminClient();
  await admin
    .from("calendar_integrations")
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", integration.id);

  return tokens.access_token;
}

async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  externalEventId: string | null,
  task: TaskRow,
  appUrl: string
) {
  const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  const projectName = project?.name ?? "Projekt";
  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const payload = {
    summary: `[${projectName}] ${task.title}`,
    description:
      (task.description ? task.description + "\n\n" : "") +
      `Odkaz: ${appUrl}/w/${task.workspace_id}/projects/${task.project_id}`,
    start: { dateTime: start.toISOString(), timeZone: "UTC" },
    end: { dateTime: end.toISOString(), timeZone: "UTC" },
    source: {
      title: "Pushnik",
      url: `${appUrl}/w/${task.workspace_id}/projects/${task.project_id}`,
    },
  };

  const method = externalEventId ? "PATCH" : "POST";
  const url = externalEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${externalEventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google event upsert failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function syncUserCalendar(integrationId: string, appUrl: string) {
  const admin = createAdminClient();

  const { data: integration } = await admin
    .from("calendar_integrations")
    .select(
      "id, user_id, provider, access_token, refresh_token, expires_at, calendar_id, sync_enabled"
    )
    .eq("id", integrationId)
    .maybeSingle<Integration>();

  if (!integration || !integration.sync_enabled) {
    return { synced: 0, skipped: true };
  }

  const accessToken = await ensureFreshToken(integration);
  const calendarId = integration.calendar_id ?? "primary";

  // Tasks in any workspace this user belongs to, with deadline, not done
  const { data: memberships } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", integration.user_id);

  const workspaceIds = (memberships ?? []).map((m) => m.workspace_id);
  if (workspaceIds.length === 0) return { synced: 0, skipped: false };

  const { data: tasks } = await admin
    .from("tasks")
    .select(
      "id, title, description, deadline, project_id, workspace_id, projects(name)"
    )
    .in("workspace_id", workspaceIds)
    .not("deadline", "is", null)
    .neq("status", "done")
    .returns<TaskRow[]>();

  let synced = 0;
  for (const task of tasks ?? []) {
    const { data: state } = await admin
      .from("calendar_sync_state")
      .select("external_event_id")
      .eq("task_id", task.id)
      .eq("integration_id", integration.id)
      .maybeSingle();

    try {
      const externalId = await upsertGoogleEvent(
        accessToken,
        calendarId,
        state?.external_event_id ?? null,
        task,
        appUrl
      );
      await admin.from("calendar_sync_state").upsert({
        task_id: task.id,
        integration_id: integration.id,
        external_event_id: externalId,
        last_synced_at: new Date().toISOString(),
      });
      synced++;
    } catch (error) {
      console.error("sync task failed", task.id, error);
    }
  }

  await admin
    .from("calendar_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integration.id);

  return { synced, skipped: false };
}
