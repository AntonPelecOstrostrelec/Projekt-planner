import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";
import { PROJECT_STATUS_LABELS, type Project, type Task } from "@/types/db";

import { ProjectBoard } from "./_components/project-board";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const { workspace } = await getWorkspaceBySlug(slug);

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle<Project>();

  if (!project) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", project.id)
    .order("position", { ascending: true })
    .returns<Task[]>();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {project.color && (
              <span
                className="h-3 w-3 rounded-full border"
                style={{ backgroundColor: project.color }}
              />
            )}
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.deadline
              ? `Deadline ${formatDistanceToNow(parseISO(project.deadline), { locale: sk, addSuffix: true })}`
              : "Bez deadline"}
            {project.description ? ` · ${project.description}` : ""}
          </p>
        </div>
        <Link href={`/w/${slug}/projects`}>
          <Button variant="ghost" size="sm">
            ← Späť na projekty
          </Button>
        </Link>
      </header>

      <ProjectBoard
        slug={slug}
        projectId={project.id}
        initialTasks={tasks ?? []}
      />
    </div>
  );
}
