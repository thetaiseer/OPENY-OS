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

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'OPENY OS <noreply@openy-os.com>';

// ── Startup env check ─────────────────────────────────────────────────────────
// Runs once when this module is first imported (server startup).
if (process.env.RESEND_API_KEY) {
  console.log('[email] RESEND_API_KEY loaded ✓');
  console.log(`[email] Default sender: ${DEFAULT_FROM}`);
} else {
  console.warn('[email] RESEND_API_KEY is not set — transactional emails will be skipped');
}

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

  const recipientCount = Array.isArray(msg.to) ? msg.to.length : 1;
  console.log(`[email] Sent successfully (${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}) | subject: "${msg.subject}"`);
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
      entity_id:   opts.entityId ?? null,
      status:      opts.status ?? 'sent',
      error:       opts.error ?? null,
    });
  } catch (err) {
    console.warn('[email] logEmailSent failed:', err instanceof Error ? err.message : String(err));
  }
}
export function teamInviteEmail(opts: {
  recipientName: string;
  inviterName?: string;
  workspaceName?: string;
  role: string;
  inviteUrl: string;
  expiresInDays?: number;
}): string {
  const workspace = opts.workspaceName ?? 'OPENY OS';
  const expiry    = opts.expiresInDays ?? 7;
  const firstName = opts.recipientName.trim().split(/\s+/)[0] || opts.recipientName.trim();

  // Preheader: short summary text shown in email client inbox preview.
  // It is hidden in the rendered email body.
  const preheader = opts.inviterName
    ? `${opts.inviterName} invited you to join ${workspace} as ${opts.role}.`
    : `You have been invited to join ${workspace} as ${opts.role}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're invited to join ${workspace}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email card — fixed 600px wide -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Header: solid purple -->
          <tr>
            <td align="center" bgcolor="#6366f1" style="background-color:#6366f1;padding:36px 32px;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:26px;font-weight:bold;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">${workspace}</h1>
              <p style="margin:10px 0 0;font-size:15px;color:#e0e0ff;font-family:Arial,Helvetica,sans-serif;">You're invited to join the team</p>
            </td>
          </tr>

          <!-- White card body -->
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:36px 32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:20px;font-weight:bold;color:#111111;font-family:Arial,Helvetica,sans-serif;">Hi ${firstName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                ${opts.inviterName
                  ? `<strong style="color:#111111;">${opts.inviterName}</strong> has invited you to join <strong style="color:#111111;">${workspace}</strong>.`
                  : `You have been invited to join <strong style="color:#111111;">${workspace}</strong>.`}
              </p>

              <!-- Role card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td bgcolor="#f7f7f7" style="background-color:#f7f7f7;border:1px solid #e0e0e0;padding:18px 22px;border-radius:8px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:bold;color:#777777;text-transform:uppercase;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">Your role</p>
                    <p style="margin:0;font-size:17px;font-weight:bold;color:#111111;font-family:Arial,Helvetica,sans-serif;">${opts.role}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA button (table-based, no gradient) -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td align="center" bgcolor="#6366f1" style="background-color:#6366f1;border-radius:8px;">
                    <a href="${opts.inviteUrl}" target="_blank"
                       style="display:inline-block;color:#ffffff;text-decoration:none;padding:14px 40px;font-size:16px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;border-radius:8px;mso-padding-alt:14px 40px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="margin:0 0 20px;font-size:13px;color:#777777;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                This invitation expires in <strong style="color:#444444;">${expiry} days</strong>. After that, you'll need to request a new one.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
                <tr><td style="border-top:1px solid #e0e0e0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 4px;font-size:12px;color:#999999;font-family:Arial,Helvetica,sans-serif;">Button not working? Copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;color:#6366f1;word-break:break-all;font-family:Arial,Helvetica,sans-serif;">${opts.inviteUrl}</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#ffffff" align="center" style="background-color:#ffffff;padding:20px 32px 28px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 4px;font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">&copy; ${new Date().getFullYear()} ${workspace}. All rights reserved.</p>
              <p style="margin:0;font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">If you did not expect this invitation, you can safely ignore this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
