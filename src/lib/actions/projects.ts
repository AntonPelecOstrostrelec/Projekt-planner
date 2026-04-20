"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";

const ProjectInput = z.object({
  name: z.string().trim().min(1, "Názov je povinný").max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Farba musí byť hex, napr. #22c55e")
    .optional()
    .nullable(),
  deadline: z.string().datetime().optional().nullable(),
});

export async function createProject(slug: string, formData: FormData) {
  const { workspace, userId } = await getWorkspaceBySlug(slug);

  const parsed = ProjectInput.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    color: formData.get("color") || null,
    deadline: (formData.get("deadline") as string) || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspace.id,
      created_by: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      deadline: parsed.data.deadline,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Nepodarilo sa vytvoriť projekt" };
  }

  revalidatePath(`/w/${slug}/projects`);
  redirect(`/w/${slug}/projects/${data.id}`);
}

const StatusInput = z.enum(["active", "paused", "archived", "done"]);

export async function updateProjectStatus(
  slug: string,
  projectId: string,
  status: string
) {
  await getWorkspaceBySlug(slug);
  const parsed = StatusInput.safeParse(status);
  if (!parsed.success) return { error: "Neplatný status" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };
  revalidatePath(`/w/${slug}/projects`);
  revalidatePath(`/w/${slug}/projects/${projectId}`);
  return { ok: true };
}
