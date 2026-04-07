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
