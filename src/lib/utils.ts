/**
 * Shared utility functions used across multiple pages.
 * Import from here instead of copy-pasting into each page.
 */

// ─── Date helpers ────────────────────────────────────────────────────────────

export function fmtDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtDateShort(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateShort(d);
}

// ─── Task helpers ────────────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdue(due_date?: string | null, status?: string | null): boolean {
  if (!due_date) return false;
  if (status === 'done' || status === 'completed' || status === 'delivered') return false;
  return new Date(due_date) < todayMidnight();
}

export function isDueSoon(due_date?: string | null, status?: string | null): boolean {
  if (!due_date) return false;
  if (status === 'done' || status === 'completed' || status === 'delivered') return false;
  const diff = (new Date(due_date).getTime() - todayMidnight().getTime()) / 86_400_000;
  return diff >= 0 && diff <= 3;
}

export function isDueToday(due_date?: string | null): boolean {
  if (!due_date) return false;
  const d = new Date(due_date);
  const today = todayMidnight();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

// ─── Badge variant helpers ───────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function taskStatusVariant(s: string): BadgeVariant {
  if (s === 'done' || s === 'completed' || s === 'delivered') return 'success';
  if (s === 'overdue') return 'danger';
  if (s === 'in_progress') return 'info';
  if (s === 'review' || s === 'in_review' || s === 'waiting_client') return 'warning';
  if (s === 'approved' || s === 'published') return 'success';
  return 'default';
}

export function taskPriorityVariant(p: string): BadgeVariant {
  if (p === 'high') return 'danger';
  if (p === 'medium') return 'warning';
  return 'default';
}

export function clientStatusVariant(s: string): BadgeVariant {
  if (s === 'active') return 'success';
  if (s === 'inactive') return 'default';
  return 'info';
}

export function contentStatusVariant(s: string): BadgeVariant {
  if (s === 'published') return 'success';
  if (s === 'approved') return 'success';
  if (s === 'scheduled') return 'info';
  if (s === 'pending_review') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'default';
}

// ─── String helpers ──────────────────────────────────────────────────────────

export function parseTags(tags: string | string[] | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return tags.split(',').map(s => s.trim()).filter(Boolean);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ─── File size ───────────────────────────────────────────────────────────────

export function fmtFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
