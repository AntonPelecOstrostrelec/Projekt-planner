import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";

import { NotificationPrefsForm } from "./prefs-form";

type Prefs = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  deadline_alerts: boolean;
  task_assigned: boolean;
  task_comments: boolean;
  daily_digest: boolean;
};

const DEFAULT_PREFS: Prefs = {
  in_app_enabled: true,
  email_enabled: true,
  push_enabled: false,
  deadline_alerts: true,
  task_assigned: true,
  task_comments: true,
  daily_digest: false,
};

export default async function NotificationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, userId } = await getWorkspaceBySlug(slug);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle<Prefs>();

  const prefs = existing ?? DEFAULT_PREFS;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notifikácie</h2>
        <p className="text-sm text-muted-foreground">
          Nastavenie pre <b>{workspace.name}</b>. Každý workspace má vlastné
          preference.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Čo chceš dostávať</CardTitle>
          <CardDescription>
            In-app funguje hneď. Email zafunguje keď admin nastaví SMTP. Web
            push treba povoliť v prehliadači (príde neskôr).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPrefsForm slug={slug} prefs={prefs} />
        </CardContent>
      </Card>
    </div>
  );
}
