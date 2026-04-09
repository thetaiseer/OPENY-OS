/**
 * Email notification helper.
 * Uses the Resend API (https://resend.com) — set RESEND_API_KEY env var.
 * Falls back gracefully if not configured.
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'OPENY OS <notifications@openy.app>';

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — email not sent:', msg.subject);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: msg.from ?? DEFAULT_FROM,
      to:   Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Email send failed (${res.status}): ${JSON.stringify(body)}`);
  }
}

// ── HTML templates ────────────────────────────────────────────────────────────

export function taskAssignedEmail(opts: {
  recipientName: string;
  taskTitle: string;
  clientName?: string;
  dueDate?: string;
  appUrl: string;
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="margin:0 0 8px;font-size:20px;color:#111">📋 New Task Assigned</h2>
  <p style="margin:0 0 24px;color:#555">Hi ${opts.recipientName}, you have been assigned a new task.</p>
  <div style="background:#f5f5f5;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-weight:600;color:#111">${opts.taskTitle}</p>
    ${opts.clientName ? `<p style="margin:0 0 4px;color:#555">Client: ${opts.clientName}</p>` : ''}
    ${opts.dueDate    ? `<p style="margin:0;color:#555">Due: ${opts.dueDate}</p>` : ''}
  </div>
  <a href="${opts.appUrl}/tasks" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">View Task →</a>
</div>`;
}

export function approvalRequestEmail(opts: {
  recipientName: string;
  taskTitle: string;
  clientName?: string;
  requestedBy?: string;
  appUrl: string;
}): string {
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="margin:0 0 8px;font-size:20px;color:#d97706">🔍 Approval Requested</h2>
  <p style="margin:0 0 24px;color:#555">Hi ${opts.recipientName}, your review is needed.</p>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-weight:600;color:#111">${opts.taskTitle}</p>
    ${opts.clientName  ? `<p style="margin:0 0 4px;color:#555">Client: ${opts.clientName}</p>` : ''}
    ${opts.requestedBy ? `<p style="margin:0;color:#555">Requested by: ${opts.requestedBy}</p>` : ''}
  </div>
  <a href="${opts.appUrl}/my-tasks" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">Review Now →</a>
</div>`;
}

export function approvalDecisionEmail(opts: {
  recipientName: string;
  taskTitle: string;
  decision: 'approved' | 'rejected' | 'needs_changes';
  notes?: string;
  appUrl: string;
}): string {
  const isApproved = opts.decision === 'approved';
  const color = isApproved ? '#16a34a' : opts.decision === 'rejected' ? '#dc2626' : '#d97706';
  const emoji = isApproved ? '✅' : opts.decision === 'rejected' ? '❌' : '🔄';
  const label = isApproved ? 'Approved' : opts.decision === 'rejected' ? 'Rejected' : 'Needs Changes';
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="margin:0 0 8px;font-size:20px;color:${color}">${emoji} Task ${label}</h2>
  <p style="margin:0 0 24px;color:#555">Hi ${opts.recipientName},</p>
  <div style="background:#f5f5f5;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 4px;font-weight:600;color:#111">${opts.taskTitle}</p>
    ${opts.notes ? `<p style="margin:8px 0 0;color:#555;font-style:italic">"${opts.notes}"</p>` : ''}
  </div>
  <a href="${opts.appUrl}/my-tasks" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">View Task →</a>
</div>`;
}

export function publishingScheduledEmail(opts: {
  recipientName: string;
  clientName?: string;
  scheduledDate: string;
  scheduledTime?: string;
  platforms?: string[];
  postTypes?: string[];
  appUrl: string;
}): string {
  const platformText = opts.platforms?.length ? opts.platforms.join(', ') : 'All platforms';
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="margin:0 0 8px;font-size:20px;color:#7c3aed">📅 Content Scheduled</h2>
  <p style="margin:0 0 24px;color:#555">Hi ${opts.recipientName}, content has been scheduled for publishing.</p>
  <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    ${opts.clientName ? `<p style="margin:0 0 4px;color:#555">Client: <strong>${opts.clientName}</strong></p>` : ''}
    <p style="margin:0 0 4px;color:#555">Date: <strong>${opts.scheduledDate}${opts.scheduledTime ? ' at ' + opts.scheduledTime : ''}</strong></p>
    <p style="margin:0 0 4px;color:#555">Platforms: <strong>${platformText}</strong></p>
    ${opts.postTypes?.length ? `<p style="margin:0;color:#555">Post types: ${opts.postTypes.join(', ')}</p>` : ''}
  </div>
  <a href="${opts.appUrl}/calendar" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">View Calendar →</a>
</div>`;
}

export async function logEmailSent(opts: {
  to: string;
  subject: string;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  status?: 'sent' | 'failed';
  error?: string;
}): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const db = createClient(url, key);
    await db.from('email_logs').insert({
      to_address:  opts.to,
      subject:     opts.subject,
      event_type:  opts.eventType ?? null,
      entity_type: opts.entityType ?? null,
      entity_id:   opts.entityId ? opts.entityId : null,
      status:      opts.status ?? 'sent',
      error:       opts.error ?? null,
    });
  } catch (err) {
    console.warn('[email] logEmailSent failed:', err instanceof Error ? err.message : String(err));
  }
}
export function deadlineAlertEmail(opts: {
  recipientName: string;
  taskTitle: string;
  daysLeft: number;
  appUrl: string;
}): string {
  const urgency = opts.daysLeft <= 0 ? '🚨 OVERDUE' : `⏰ ${opts.daysLeft}d remaining`;
  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <h2 style="margin:0 0 8px;font-size:20px;color:#dc2626">${urgency} — Deadline Alert</h2>
  <p style="margin:0 0 24px;color:#555">Hi ${opts.recipientName},</p>
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:20px 24px;margin-bottom:24px">
    <p style="margin:0;font-weight:600;color:#111">${opts.taskTitle}</p>
  </div>
  <a href="${opts.appUrl}/tasks" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">View Task →</a>
</div>`;
}
