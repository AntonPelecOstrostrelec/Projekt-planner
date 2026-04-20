import { differenceInHours, formatDistanceToNowStrict, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

export type DeadlineSeverity =
  | "none"
  | "overdue"
  | "due_today"
  | "due_24h"
  | "due_72h"
  | "future";

export function deadlineSeverity(
  iso: string | null | undefined,
  doneStatus = false
): DeadlineSeverity {
  if (!iso || doneStatus) return "none";
  const date = typeof iso === "string" ? parseISO(iso) : new Date(iso);
  const now = new Date();
  const diffHours = differenceInHours(date, now);
  if (diffHours < 0) return "overdue";
  if (diffHours < 12) return "due_today";
  if (diffHours < 24) return "due_24h";
  if (diffHours < 72) return "due_72h";
  return "future";
}

export function deadlineLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = typeof iso === "string" ? parseISO(iso) : new Date(iso);
  const diff = date.getTime() - Date.now();
  const absHours = Math.abs(diff) / (1000 * 60 * 60);
  if (absHours < 48) {
    // relative up to ~2 days
    return formatDistanceToNowStrict(date, { locale: sk, addSuffix: true });
  }
  return date.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export const SEVERITY_STYLE: Record<
  DeadlineSeverity,
  { className: string; icon: string }
> = {
  none: { className: "text-muted-foreground", icon: "" },
  overdue: { className: "bg-red-500/20 text-red-300 border-red-500/40", icon: "🔥" },
  due_today: { className: "bg-orange-500/20 text-orange-300 border-orange-500/40", icon: "⏰" },
  due_24h: { className: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: "⏰" },
  due_72h: { className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", icon: "⏱️" },
  future: { className: "bg-muted text-muted-foreground border-border", icon: "📅" },
};
