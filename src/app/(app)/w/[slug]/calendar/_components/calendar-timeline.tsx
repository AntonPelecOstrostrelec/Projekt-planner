"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import { sk } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { deadlineSeverity, SEVERITY_STYLE } from "@/lib/deadline";
import type { Project, Task } from "@/types/db";

type Props = {
  tasks: Task[];
  projects: Pick<Project, "id" | "name" | "color" | "deadline">[];
  slug: string;
};

const DAYS_VISIBLE = 21; // 3 weeks

export function CalendarTimeline({ tasks, projects, slug }: Props) {
  const today = startOfDay(new Date());
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < DAYS_VISIBLE; i++) list.push(addDays(today, i));
    return list;
  }, [today]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.deadline) continue;
      const d = startOfDay(new Date(t.deadline));
      if (d < today) continue;
      if (differenceInCalendarDays(d, today) >= DAYS_VISIBLE) continue;
      const key = d.toISOString();
      const bucket = map.get(key) ?? [];
      bucket.push(t);
      map.set(key, bucket);
    }
    return map;
  }, [tasks, today]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.deadline || t.status === "done") return false;
        return new Date(t.deadline) < today;
      }),
    [tasks, today]
  );

  return (
    <div className="space-y-4">
      {overdueTasks.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <div className="mb-2 text-sm font-semibold text-red-300">
            🔥 {overdueTasks.length} po deadline — doriešiť
          </div>
          <div className="flex flex-wrap gap-2">
            {overdueTasks.slice(0, 8).map((t) => (
              <Link
                key={t.id}
                href={`/w/${slug}/projects/${t.project_id}`}
                className="rounded border border-red-500/40 bg-background px-2 py-1 text-xs hover:bg-red-500/10"
              >
                {t.title}
              </Link>
            ))}
            {overdueTasks.length > 8 && (
              <span className="text-xs text-muted-foreground">
                …a ďalších {overdueTasks.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${DAYS_VISIBLE}, minmax(120px, 1fr))`,
          }}
        >
          {days.map((day) => {
            const key = day.toISOString();
            const items = tasksByDay.get(key) ?? [];
            const isToday = isSameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-[200px] flex-col rounded-md border p-2",
                  isToday && "border-primary bg-primary/5",
                  isWeekend && !isToday && "bg-muted/40"
                )}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {format(day, "EEE", { locale: sk })}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isToday && "text-primary"
                    )}
                  >
                    {format(day, "d.M.")}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  {items.map((t) => {
                    const severity = deadlineSeverity(
                      t.deadline,
                      t.status === "done"
                    );
                    const style = SEVERITY_STYLE[severity];
                    const project = projectsById.get(t.project_id);
                    return (
                      <Link
                        key={t.id}
                        href={`/w/${slug}/projects/${t.project_id}`}
                        className={cn(
                          "rounded border px-2 py-1 text-[11px] leading-snug transition-colors hover:border-primary",
                          style.className
                        )}
                      >
                        {project?.color && (
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                        )}
                        <span className="font-medium">{t.title}</span>
                        {t.deadline && (
                          <div className="text-[10px] opacity-70">
                            {format(new Date(t.deadline), "HH:mm")}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
