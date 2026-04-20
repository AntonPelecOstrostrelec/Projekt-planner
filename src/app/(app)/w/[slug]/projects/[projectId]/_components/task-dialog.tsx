"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTask, deleteTask, updateTask } from "@/lib/actions/tasks";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/db";

type Props = {
  slug: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialStatus?: TaskStatus;
  task?: Task;
};

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskDialog({
  slug,
  projectId,
  open,
  onOpenChange,
  mode,
  initialStatus,
  task,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [estimate, setEstimate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (mode === "edit" && task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setDeadline(task.deadline ? toLocalInput(task.deadline) : "");
      setEstimate(task.estimate_hours?.toString() ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStatus(initialStatus ?? "todo");
      setPriority("medium");
      setDeadline("");
      setEstimate("");
    }
    setError(null);
  }, [mode, task, initialStatus, open]);

  function submit() {
    setError(null);
    const deadlineIso = deadline ? new Date(deadline).toISOString() : null;
    const estimateNum = estimate ? Number(estimate) : null;

    startTransition(async () => {
      if (mode === "create") {
        const res = await createTask(slug, {
          project_id: projectId,
          title,
          description: description || null,
          status,
          priority,
          deadline: deadlineIso,
          estimate_hours: estimateNum,
        });
        if (res?.error) return setError(res.error);
      } else if (task) {
        const res = await updateTask(slug, task.id, {
          title,
          description: description || null,
          status,
          priority,
          deadline: deadlineIso,
          estimate_hours: estimateNum,
        });
        if (res?.error) return setError(res.error);
      }
      onOpenChange(false);
    });
  }

  function remove() {
    if (!task) return;
    if (!confirm("Naozaj zmazať tento task?")) return;
    startTransition(async () => {
      const res = await deleteTask(slug, task.id);
      if (res?.error) return setError(res.error);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nový task" : "Detail tasku"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Pridaj task do boardu."
              : "Uprav detaily alebo zmaž task."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Názov</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Čo treba spraviť?"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Detaily, linky, acceptance criteria"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorita</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimate">Odhad (h)</Label>
              <Input
                id="estimate"
                type="number"
                min={0}
                step="0.25"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="napr. 2.5"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {mode === "edit" && (
            <Button
              variant="destructive"
              onClick={remove}
              disabled={pending}
              className="mr-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Zmazať
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={pending || !title.trim()}>
            {pending ? "Ukladám…" : mode === "create" ? "Vytvoriť" : "Uložiť"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
