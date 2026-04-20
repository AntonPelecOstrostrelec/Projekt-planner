"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";

const PrefsSchema = z.object({
  in_app_enabled: z.boolean(),
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  deadline_alerts: z.boolean(),
  task_assigned: z.boolean(),
  task_comments: z.boolean(),
  daily_digest: z.boolean(),
});

export async function upsertNotificationPrefs(
  slug: string,
  input: z.infer<typeof PrefsSchema>
) {
  const { workspace, userId } = await getWorkspaceBySlug(slug);

  const parsed = PrefsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    workspace_id: workspace.id,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/w/${slug}/settings/notifications`);
  return { ok: true };
}
