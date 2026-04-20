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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user!.id);

  const hasWorkspace = (memberships?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Čau {user?.email?.split("@")[0]}.
        </h1>
        <p className="text-muted-foreground">
          Toto je Fáza 0 – kostra stojí. Ďalšie fázy pridávajú projekty, tasky,
          kalendár a AI coacha.
        </p>
      </div>

      {!hasWorkspace ? (
        <Card>
          <CardHeader>
            <CardTitle>Žiaden workspace ešte nemáš</CardTitle>
            <CardDescription>
              Vytvor si prvý workspace, alebo nech ťa niekto pozve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/workspaces/new">
              <Button>Vytvoriť workspace</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {memberships!.map((m) => {
            // supabase-js types the join as an array; in practice it's a single row
            const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
            if (!ws) return null;
            return (
              <Card key={ws.id}>
                <CardHeader>
                  <CardTitle>{ws.name}</CardTitle>
                  <CardDescription>
                    Rola: <b>{m.role}</b>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/w/${ws.slug}`}>
                    <Button variant="outline">Otvoriť</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
