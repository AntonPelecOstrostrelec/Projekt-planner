import { cache } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceRole } from "@/types/db";

export type WorkspaceContext = {
  workspace: Workspace;
  role: WorkspaceRole;
  userId: string;
};

export const getWorkspaceBySlug = cache(
  async (slug: string): Promise<WorkspaceContext> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, slug, name, owner_id, created_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();

    if (!workspace) notFound();

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) notFound();

    return {
      workspace: workspace as Workspace,
      role: membership.role as WorkspaceRole,
      userId: user.id,
    };
  }
);
