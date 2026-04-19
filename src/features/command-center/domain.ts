export const PIPELINE_COLUMNS = ['todo', 'in_progress', 'review', 'client_approved'] as const;

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type DeadlineState = 'normal' | 'warning' | 'overdue';

export interface CommandCenterUser {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'team_member';
  activeTasks: number;
  capacityLimit: number;
}

export interface PipelineTask {
  id: string;
  title: string;
  assigneeId: string | null;
  projectTag: string;
  priority: TaskPriority;
  status: PipelineColumn;
  dueAt: string | null;
  workloadPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface VaultAsset {
  id: string;
  taskId: string | null;
  projectTag: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  r2Key: string;
  uploadState: 'pending' | 'uploading' | 'complete' | 'failed' | 'aborted';
  multipartUploadId: string | null;
  createdAt: string;
}

export interface RadarSnapshot {
  activeProjects: number;
  tasksNearingDeadline: number;
  teamOutputByUser: Array<{
    userId: string;
    completedTasks: number;
    throughputScore: number;
  }>;
  recentUploads: number;
}

export function getDeadlineState(
  dueAt: string | null,
  now: Date = new Date(),
  warningHours = 48,
): DeadlineState {
  if (!dueAt) return 'normal';

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'normal';

  const msLeft = due.getTime() - now.getTime();
  if (msLeft < 0) return 'overdue';
  if (msLeft <= warningHours * 60 * 60 * 1000) return 'warning';
  return 'normal';
}

export function getTimeLeft(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return 'No deadline';

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'No deadline';

  const msLeft = due.getTime() - now.getTime();
  const isOverdue = msLeft < 0;
  const totalSeconds = Math.floor(Math.abs(msLeft) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const prefix = isOverdue ? 'Overdue by ' : '';
  return `${prefix}${days}d ${hours}h ${minutes}m`;
}

export type WorkloadIndicator = 'free' | 'balanced' | 'busy' | 'overloaded';

export function getWorkloadIndicator(
  activeTasks: number,
  capacityLimit: number,
): WorkloadIndicator {
  if (capacityLimit <= 0) return 'overloaded';
  const ratio = activeTasks / capacityLimit;

  if (ratio < 0.4) return 'free';
  if (ratio < 0.75) return 'balanced';
  if (ratio <= 1) return 'busy';
  return 'overloaded';
}
