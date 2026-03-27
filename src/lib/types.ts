// ============================================================
// OPENY OS – Core Data Models
// ============================================================

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  website?: string;
  status: "active" | "inactive" | "prospect";
  createdAt: string;
  initials: string;
  color: string;
  projects: number;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  client: string;
  description: string;
  status: "active" | "completed" | "paused" | "planning" | "review";
  progress: number;
  team: number;
  dueDate: string;
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  project: string;
  assignedTo: string;
  assignee: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "active" | "away" | "offline";
  initials: string;
  color: string;
  projects: number;
  createdAt: string;
}

export type ActivityType =
  | "client_added"
  | "task_completed"
  | "task_created"
  | "project_created"
  | "project_updated"
  | "member_joined"
  | "report_generated";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  detail: string;
  entityId: string;
  timestamp: string;
}

export type ServiceStatus = "operational" | "degraded" | "down";

export interface SystemStatus {
  name: string;
  latency: string;
  status: ServiceStatus;
}
