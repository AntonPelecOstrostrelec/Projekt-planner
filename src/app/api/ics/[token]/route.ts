import { NextResponse } from "next/server";

import { buildICS } from "@/lib/ics";
import { createAdminClient } from "@/lib/supabase/admin";

type IcsToken = {
  token: string;
  user_id: string;
  workspace_id: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  workspace_id: string;
  project_id: string;
  projects: { name: string } | { name: string }[] | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return new NextResponse("Service not configured", { status: 503 });
  }

  const { data: tokenRow } = await admin
    .from("ics_tokens")
    .select("token, user_id, workspace_id")
    .eq("token", token)
    .maybeSingle<IcsToken>();

  if (!tokenRow) {
    return new NextResponse("Invalid token", { status: 404 });
  }

  // Tasks the user has access to (member of workspace), with deadlines
  let query = admin
    .from("tasks")
    .select("id, title, description, deadline, workspace_id, project_id, projects(name)")
    .not("deadline", "is", null);

  if (tokenRow.workspace_id) {
    query = query.eq("workspace_id", tokenRow.workspace_id);
  } else {
    // All workspaces the user is a member of
    const { data: memberships } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", tokenRow.user_id);
    const workspaceIds = (memberships ?? []).map((m) => m.workspace_id);
    if (workspaceIds.length === 0) {
      return icsResponse("Pushnik", []);
    }
    query = query.in("workspace_id", workspaceIds);
  }

  const { data: tasks } = await query.returns<TaskRow[]>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const events = (tasks ?? []).map((t) => {
    const deadline = new Date(t.deadline);
    const end = new Date(deadline.getTime() + 30 * 60 * 1000);
    const project = Array.isArray(t.projects) ? t.projects[0] : t.projects;
    const projectName = project?.name ?? "Projekt";
    return {
      uid: t.id,
      summary: `[${projectName}] ${t.title}`,
      description: t.description,
      start: deadline,
      end,
      url: `${appUrl}/w/${t.workspace_id}/projects/${t.project_id}`,
    };
  });

  return icsResponse("Pushnik deadliny", events);
}

function icsResponse(name: string, events: Parameters<typeof buildICS>[1]) {
  const body = buildICS(name, events);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
