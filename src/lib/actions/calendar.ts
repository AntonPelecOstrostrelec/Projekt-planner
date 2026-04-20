"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function disconnectGoogleCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("calendar_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google");

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleSync(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("calendar_integrations")
    .update({ sync_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("provider", "google");

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
