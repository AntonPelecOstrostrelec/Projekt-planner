"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

import { createClient } from "@/lib/supabase/server";

export async function ensureIcsToken(workspaceId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let query = supabase.from("ics_tokens").select("token").eq("user_id", user.id);
  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId);
  } else {
    query = query.is("workspace_id", null);
  }
  const { data: existing } = await query.maybeSingle();
  if (existing?.token) {
    return { token: existing.token };
  }

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("ics_tokens").insert({
    token,
    user_id: user.id,
    workspace_id: workspaceId,
  });
  if (error) return { error: error.message };
  return { token };
}

export async function regenerateIcsToken(workspaceId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let delQuery = supabase.from("ics_tokens").delete().eq("user_id", user.id);
  if (workspaceId) delQuery = delQuery.eq("workspace_id", workspaceId);
  else delQuery = delQuery.is("workspace_id", null);
  await delQuery;

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("ics_tokens").insert({
    token,
    user_id: user.id,
    workspace_id: workspaceId,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { token };
}
