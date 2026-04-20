export type NotificationKind =
  | "deadline_72h"
  | "deadline_24h"
  | "deadline_overdue"
  | "task_assigned"
  | "task_comment"
  | "project_invite"
  | "mention"
  | "system";

export type Notification = {
  id: string;
  user_id: string;
  workspace_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  deadline_72h: "Deadline o 3 dni",
  deadline_24h: "Deadline do 24h",
  deadline_overdue: "Meškáš!",
  task_assigned: "Nový task",
  task_comment: "Komentár",
  project_invite: "Pozvánka",
  mention: "Zmienka",
  system: "Systém",
};
