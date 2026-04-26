/** Maps DB task.status values to lang-context translation keys. */
export const TASK_STATUS_TKEY: Record<string, string> = {
  todo: 'todo',
  in_progress: 'inProgress',
  in_review: 'review',
  review: 'review',
  done: 'done',
  delivered: 'delivered',
  overdue: 'overdue',
  completed: 'taskStatusCompleted',
  published: 'taskStatusPublished',
  cancelled: 'taskStatusCancelled',
  scheduled: 'taskStatusScheduled',
  approved: 'taskStatusApproved',
  waiting_client: 'taskStatusWaitingClient',
};

export function taskStatusLabel(s: string, t: (k: string) => string): string {
  const key = TASK_STATUS_TKEY[s];
  return key ? t(key) : s;
}
