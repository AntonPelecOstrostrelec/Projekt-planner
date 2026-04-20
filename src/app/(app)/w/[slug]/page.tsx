import Link from "next/link";

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

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceBySlug(slug);

  const supabase = await createClient();

  const [{ count: memberCount }, { count: projectCount }, { count: taskCount }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id),
      supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .neq("status", "archived"),
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .neq("status", "done"),
    ]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Projekty</CardTitle>
          <CardDescription>{projectCount ?? 0} aktívnych</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/w/${workspace.slug}/projects`}>
            <Button variant="outline" size="sm">
              Otvoriť
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Otvorené tasky</CardTitle>
          <CardDescription>{taskCount ?? 0} čaká na vás</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Rozdelenie podľa projektov vidíš v board view.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Členovia</CardTitle>
          <CardDescription>{memberCount ?? 0} aktívnych</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pozývanie príde vo Fáze 3.
        </CardContent>
      </Card>
    </div>
  );
}
