import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";
import { PROJECT_STATUS_LABELS, type Project } from "@/types/db";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceBySlug(slug);

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projekty</h2>
        <Link href={`/w/${slug}/projects/new`}>
          <Button>Nový projekt</Button>
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Žiaden projekt</CardTitle>
            <CardDescription>
              Zatiaľ tu nič nie je. Vytvor si prvý, nech appka má čo riešiť.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/w/${slug}/projects/${p.id}`}
              className="group"
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {p.color && (
                      <span
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: p.color }}
                      />
                    )}
                    <CardTitle className="truncate">{p.name}</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {p.description || "Bez popisu"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {PROJECT_STATUS_LABELS[p.status]}
                  </Badge>
                  <span>
                    {p.deadline
                      ? `Deadline ${formatDistanceToNow(parseISO(p.deadline), { locale: sk, addSuffix: true })}`
                      : "Bez deadline"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
