export type WorkspaceRole = "owner" | "admin" | "member" | "guest";
export type ProjectStatus = "active" | "paused" | "archived" | "done";
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectRole = "lead" | "contributor" | "viewer";

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string | null;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimate_hours: number | null;
  deadline: string | null;
  position: number;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWithAssignees = Task & {
  assignees: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">[];
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "review", "done"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To-do",
  doing: "Robí sa",
  review: "Review",
  done: "Hotovo",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Nízka",
  medium: "Stredná",
  high: "Vysoká",
  urgent: "Urgent",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Aktívny",
  paused: "Pauznutý",
  archived: "Archivovaný",
  done: "Hotový",
};
