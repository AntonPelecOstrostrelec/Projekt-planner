import Link from "next/link";
import { headers } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ensureIcsToken } from "@/lib/actions/ics";
import { getWorkspaceBySlug } from "@/lib/workspace";
import type { Project, Task } from "@/types/db";

import { googleOauthEnabled } from "@/lib/google/oauth";

import { CalendarTimeline } from "./_components/calendar-timeline";
import { GoogleCalendarCard } from "./_components/google-calendar-card";
import { IcsFeedCard } from "./_components/ics-feed-card";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceBySlug(slug);

  const supabase = await createClient();
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .not("deadline", "is", null)
      .order("deadline", { ascending: true })
      .returns<Task[]>(),
    supabase
      .from("projects")
      .select("id, name, color, deadline")
      .eq("workspace_id", workspace.id)
      .returns<Pick<Project, "id" | "name" | "color" | "deadline">[]>(),
  ]);

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("id, account_email, sync_enabled, last_synced_at")
    .eq("provider", "google")
    .maybeSingle<{
      id: string;
      account_email: string | null;
      sync_enabled: boolean;
      last_synced_at: string | null;
    }>();

  const tokenRes = await ensureIcsToken(workspace.id);
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost:3000"}`;
  const feedUrl = tokenRes.token
    ? `${origin}/api/ics/${tokenRes.token}`
    : null;

  const upcoming = (tasks ?? []).slice(0, 10);
  const projectsById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Kalendár</h2>
        <p className="text-sm text-muted-foreground">
          Timeline taskov podľa deadlinov + ICS feed na napojenie do tvojho
          kalendára.
        </p>
      </div>

      <CalendarTimeline
        tasks={tasks ?? []}
        projects={projects ?? []}
        slug={slug}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Najbližšie deadliny</CardTitle>
            <CardDescription>
              Top 10 úloh podľa dátumu. Šup šup, čas beží.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Žiadne deadliny. Ideálny stav — alebo si ich len nepriradil.
              </p>
            ) : (
              upcoming.map((t) => {
                const project = projectsById.get(t.project_id);
                return (
                  <Link
                    key={t.id}
                    href={`/w/${slug}/projects/${t.project_id}`}
                    className="block rounded-md border p-3 transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {t.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {project?.name ?? "Projekt"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.deadline!).toLocaleDateString("sk-SK", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <IcsFeedCard workspaceId={workspace.id} feedUrl={feedUrl} />
      </div>

      <GoogleCalendarCard
        enabled={googleOauthEnabled()}
        integration={integration ?? null}
      />
    </div>
  );
}
