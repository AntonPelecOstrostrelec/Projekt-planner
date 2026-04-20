"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/workspace";
import type { TaskStatus } from "@/types/db";

const TaskCreateInput = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "doing", "review", "done"]).default("todo"),
  deadline: z.string().datetime().optional().nullable(),
  estimate_hours: z
    .number()
    .nonnegative()
    .max(999)
    .optional()
    .nullable(),
});

export async function createTask(
  slug: string,
  input: z.infer<typeof TaskCreateInput>
) {
  const { userId } = await getWorkspaceBySlug(slug);
  const parsed = TaskCreateInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const supabase = await createClient();

  // Place at the bottom of its column
  const { data: maxRow } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", parsed.data.project_id)
    .eq("status", parsed.data.status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (maxRow?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.project_id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: parsed.data.status,
      deadline: parsed.data.deadline,
      estimate_hours: parsed.data.estimate_hours,
      created_by: userId,
      position: nextPos,
    })
    .select("id, project_id")
    .single();

  if (error || !data) return { error: error?.message ?? "Nepodarilo sa" };

  revalidatePath(`/w/${slug}/projects/${data.project_id}`);
  return { ok: true, id: data.id };
}

const TaskUpdateInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "doing", "review", "done"]).optional(),
  deadline: z.string().datetime().nullable().optional(),
  estimate_hours: z.number().nonnegative().max(999).nullable().optional(),
  position: z.number().optional(),
});

export async function updateTask(
  slug: string,
  taskId: string,
  input: z.infer<typeof TaskUpdateInput>
) {
  await getWorkspaceBySlug(slug);
  const parsed = TaskUpdateInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(parsed.data)
    .eq("id", taskId)
    .select("project_id")
    .single();

  if (error || !data) return { error: error?.message ?? "Nepodarilo sa" };

  revalidatePath(`/w/${slug}/projects/${data.project_id}`);
  return { ok: true };
}

export async function deleteTask(slug: string, taskId: string) {
  await getWorkspaceBySlug(slug);
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  if (task?.project_id) {
    revalidatePath(`/w/${slug}/projects/${task.project_id}`);
  }
  return { ok: true };
}

/**
 * Move a task to a new status column at a given index. Positions are rewritten
 * for the entire target column so lexicographic drifts don't accumulate.
 */
export async function moveTask(
  slug: string,
  taskId: string,
  targetStatus: TaskStatus,
  orderedIdsInColumn: string[]
) {
  await getWorkspaceBySlug(slug);
  const supabase = await createClient();

  // First set the new status on the moving task
  const { data: moved, error: updErr } = await supabase
    .from("tasks")
    .update({ status: targetStatus })
    .eq("id", taskId)
    .select("project_id")
    .single();

  if (updErr || !moved) return { error: updErr?.message ?? "Nepodarilo sa" };

  // Then rewrite positions for the column in order
  if (orderedIdsInColumn.length > 0) {
    const updates = orderedIdsInColumn.map((id, index) =>
      supabase.from("tasks").update({ position: index + 1 }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const anyError = results.find((r) => r.error);
    if (anyError?.error) return { error: anyError.error.message };
  }

  revalidatePath(`/w/${slug}/projects/${moved.project_id}`);
  return { ok: true };
}
