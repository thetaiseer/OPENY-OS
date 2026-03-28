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
  | "client_updated"
  | "client_deleted"
  | "task_completed"
  | "task_created"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "member_joined"
  | "member_removed"
  | "report_generated";
  | "report_generated"
  | "invite_sent"
  | "invite_cancelled"
  | "invite_accepted"
  | "invite_expired";

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

// ── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | "client_created"
  | "client_updated"
  | "project_created"
  | "project_updated"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "member_invited"
  | "member_added"
  | "invite_accepted"
  | "invite_cancelled"
  | "invite_expired"
  | "status_change";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

// ── Invitations ───────────────────────────────────────────────

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export interface Invitation {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  invitedBy: string;
  invitedByName?: string;
  status: InvitationStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  cancelledAt?: string | null;
}
