"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moveTask } from "@/lib/actions/tasks";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/db";

import { TaskDialog } from "./task-dialog";

export function ProjectBoard({
  slug,
  projectId,
  initialTasks,
}: {
  slug: string;
  projectId: string;
  initialTasks: Task[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [, startTransition] = useTransition();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { mode: "create"; status: TaskStatus }
    | { mode: "edit"; task: Task }
    | null
  >(null);

  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Supabase Realtime: update local state when anyone mutates tasks.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as Task;
              if (prev.some((t) => t.id === next.id)) return prev;
              return [...prev, next].sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Task;
              return prev
                .map((t) => (t.id === next.id ? next : t))
                .sort((a, b) => a.position - b.position);
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Task;
              return prev.filter((t) => t.id !== old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      doing: [],
      review: [],
      done: [],
    };
    for (const t of tasks) map[t.status].push(t);
    for (const k of TASK_STATUSES) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function findTask(id: string) {
    return tasks.find((t) => t.id === id) ?? null;
  }

  function findColumnOfTask(id: string): TaskStatus | null {
    return findTask(id)?.status ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTask = findTask(activeId);
    if (!activeTask) return;

    // Target is either another task id or a column id ("col:todo")
    const targetStatus: TaskStatus = overId.startsWith("col:")
      ? (overId.slice(4) as TaskStatus)
      : findColumnOfTask(overId) ?? activeTask.status;

    // Compute new order of target column
    const column = tasks
      .filter((t) => t.status === targetStatus && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let insertIndex = column.length;
    if (!overId.startsWith("col:")) {
      const idx = column.findIndex((t) => t.id === overId);
      if (idx >= 0) insertIndex = idx;
    }

    const reordered = [...column];
    reordered.splice(insertIndex, 0, { ...activeTask, status: targetStatus });

    // Optimistic UI
    setTasks((prev) => {
      const others = prev.filter((t) => t.status !== targetStatus && t.id !== activeId);
      const rebuilt = reordered.map((t, i) => ({
        ...t,
        position: i + 1,
        status: targetStatus,
      }));
      return [...others, ...rebuilt];
    });

    const orderedIds = reordered.map((t) => t.id);
    startTransition(async () => {
      await moveTask(slug, activeId, targetStatus, orderedIds);
    });
  }

  const activeTask = activeTaskId ? findTask(activeTaskId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={byStatus[status]}
              onAdd={() => setDialog({ mode: "create", status })}
              onEdit={(task) => setDialog({ mode: "edit", task })}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {dialog && (
        <TaskDialog
          slug={slug}
          projectId={projectId}
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          mode={dialog.mode}
          initialStatus={dialog.mode === "create" ? dialog.status : undefined}
          task={dialog.mode === "edit" ? dialog.task : undefined}
        />
      )}
    </>
  );
}

function Column({
  status,
  tasks,
  onAdd,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  onAdd: () => void;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `col:${status}`,
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[400px] flex-col rounded-lg border bg-muted/20 p-3 transition-colors",
        isOver && "border-primary bg-muted/40"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onAdd} aria-label="Pridať">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onEdit(task)}
            />
          ))}
          {tasks.length === 0 && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-md border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
            >
              + Pridať task
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}

function TaskCard({
  task,
  onClick,
  dragging,
}: {
  task: Task;
  onClick?: () => void;
  dragging?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "cursor-grab rounded-md border bg-background p-3 text-sm shadow-sm transition-colors hover:border-primary active:cursor-grabbing",
        dragging && "rotate-1 shadow-xl"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 font-medium leading-snug">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
      {task.deadline && (
        <p className="mt-2 text-xs text-muted-foreground">
          ⏰ {new Date(task.deadline).toLocaleDateString("sk-SK")}
        </p>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={priority}>{TASK_PRIORITY_LABELS[priority]}</Badge>
  );
}
