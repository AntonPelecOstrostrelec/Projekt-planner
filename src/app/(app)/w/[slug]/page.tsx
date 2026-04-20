import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!workspace) notFound();

  const { count: memberCount } = await supabase
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{workspace.name}</h1>
        <p className="text-muted-foreground">/{workspace.slug}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Členovia</CardTitle>
            <CardDescription>{memberCount ?? 0} aktívnych</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pozývanie a správa rolí príde vo Fáze 3.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projekty</CardTitle>
            <CardDescription>Zatiaľ nič. Fáza 1 ide.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Onedlho tu bude CRUD + Kanban.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
