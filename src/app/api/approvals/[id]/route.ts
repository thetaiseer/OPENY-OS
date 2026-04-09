/**
 * GET    /api/approvals/[id] — get a single approval
 * PATCH  /api/approvals/[id] — update approval status/notes
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { createNotification } from '@/lib/notification-service';
import { sendEmail, approvalDecisionEmail, logEmailSent } from '@/lib/email';

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'] as const;

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const db = getDb();
  const { data, error } = await db.from('approvals').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  return NextResponse.json({ success: true, approval: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === 'string' && (VALID_STATUSES as readonly string[]).includes(body.status)) {
    updatePayload.status = body.status;
  }
  if (typeof body.notes === 'string') updatePayload.notes = body.notes;
  if (typeof body.reviewer_id === 'string') updatePayload.reviewer_id = body.reviewer_id;
  if (typeof body.reviewer_name === 'string') updatePayload.reviewer_name = body.reviewer_name;

  const db = getDb();
  const { data, error } = await db.from('approvals').update(updatePayload).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Fire notification for status change
  if (updatePayload.status && data) {
    const statusStr = String(updatePayload.status);
    const notifType = statusStr === 'approved' ? 'success' as const : statusStr === 'rejected' ? 'error' as const : 'warning' as const;
    const label = statusStr === 'approved' ? 'Approved' : statusStr === 'rejected' ? 'Rejected' : 'Needs Changes';
    void createNotification({
      title:       `Approval ${label}`,
      message:     `The approval has been ${statusStr.replace('_', ' ')}${data.notes ? `: "${data.notes}"` : ''}`,
      type:        notifType,
      event_type:  statusStr === 'approved' ? 'approval_approved' : statusStr === 'rejected' ? 'approval_rejected' : 'approval_needs_changes',
      task_id:     data.task_id ?? null,
      entity_type: 'approval',
      entity_id:   id,
      action_url:  '/my-tasks',
    });
  }

  // Fire email to task creator if available
  const requesterEmail = typeof body.requester_email === 'string' ? body.requester_email : null;
  if (requesterEmail && updatePayload.status) {
    const statusStr = String(updatePayload.status);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    void (async () => {
      try {
        await sendEmail({
          to: requesterEmail,
          subject: `Approval ${statusStr}: ${String(body.task_title ?? 'Task')}`,
          html: approvalDecisionEmail({
            recipientName: String(body.requester_name ?? 'Team'),
            taskTitle: String(body.task_title ?? 'Task'),
            decision: statusStr as 'approved' | 'rejected' | 'needs_changes',
            notes: typeof data.notes === 'string' ? data.notes : undefined,
            appUrl,
          }),
        });
        void logEmailSent({ to: requesterEmail, subject: `Approval ${statusStr}`, eventType: `approval_${statusStr}`, entityType: 'approval', entityId: id });
      } catch (emailErr) {
        console.warn('[approvals/[id]] email failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
        void logEmailSent({ to: requesterEmail, subject: `Approval ${statusStr}`, status: 'failed', error: String(emailErr), eventType: `approval_${statusStr}`, entityType: 'approval', entityId: id });
      }
    })();
  }

  return NextResponse.json({ success: true, approval: data });
}
