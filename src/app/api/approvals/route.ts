/**
 * GET  /api/approvals — list approvals
 * POST /api/approvals — create an approval record
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { notifyApprovalRequested } from '@/lib/notification-service';
import { sendEmail, approvalRequestEmail, logEmailSent } from '@/lib/email';

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const taskId   = searchParams.get('task_id');
  const assetId  = searchParams.get('asset_id');
  const clientId = searchParams.get('client_id');
  const status   = searchParams.get('status');

  const db = getDb();
  let query = db.from('approvals').select('*').order('created_at', { ascending: false });
  if (taskId)   query = query.eq('task_id', taskId);
  if (assetId)  query = query.eq('asset_id', assetId);
  if (clientId) query = query.eq('client_id', clientId);
  if (status)   query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, approvals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getDb();
  const insertPayload: Record<string, unknown> = {
    status: 'pending',
  };

  if (typeof body.task_id   === 'string') insertPayload.task_id   = body.task_id;
  if (typeof body.asset_id  === 'string') insertPayload.asset_id  = body.asset_id;
  if (typeof body.client_id === 'string') insertPayload.client_id = body.client_id;
  if (typeof body.client_name === 'string') insertPayload.client_name = body.client_name;
  if (typeof body.reviewer_id === 'string') insertPayload.reviewer_id = body.reviewer_id;
  if (typeof body.reviewer_name === 'string') insertPayload.reviewer_name = body.reviewer_name;
  if (typeof body.requested_by === 'string') insertPayload.requested_by = body.requested_by;
  if (typeof body.requested_by_name === 'string') insertPayload.requested_by_name = body.requested_by_name;
  if (typeof body.notes === 'string') insertPayload.notes = body.notes;
  if (typeof body.status === 'string' && (VALID_STATUSES as readonly string[]).includes(body.status)) {
    insertPayload.status = body.status;
  }

  const { data, error } = await db.from('approvals').insert(insertPayload).select().single();
  if (error) {
    console.error('[POST /api/approvals] db error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Link approval to task
  if (insertPayload.task_id && data?.id) {
    void db.from('tasks').update({ approval_id: data.id }).eq('id', insertPayload.task_id)
      .then(({ error: e }) => { if (e) console.warn('[approvals] task link failed:', e.message); });
  }

  // Fire notification (side effect)
  if (data?.id) {
    void notifyApprovalRequested({
      taskId: String(insertPayload.task_id ?? ''),
      taskTitle: String(body.task_title ?? 'Task'),
      reviewerId: typeof insertPayload.reviewer_id === 'string' ? insertPayload.reviewer_id : null,
      clientId: typeof insertPayload.client_id === 'string' ? insertPayload.client_id : null,
      approvalId: data.id,
    });
  }

  // Fire email (side effect)
  const reviewerEmail = typeof body.reviewer_email === 'string' ? body.reviewer_email : null;
  if (reviewerEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    void (async () => {
      try {
        await sendEmail({
          to: reviewerEmail,
          subject: `Approval Requested: ${String(body.task_title ?? 'Task')}`,
          html: approvalRequestEmail({
            recipientName: String(insertPayload.reviewer_name ?? 'Team'),
            taskTitle: String(body.task_title ?? 'Task'),
            clientName: typeof insertPayload.client_name === 'string' ? insertPayload.client_name : undefined,
            requestedBy: typeof insertPayload.requested_by_name === 'string' ? insertPayload.requested_by_name : undefined,
            appUrl,
          }),
        });
        void logEmailSent({ to: reviewerEmail, subject: `Approval Requested`, eventType: 'approval_requested', entityType: 'approval', entityId: data.id });
      } catch (emailErr) {
        console.warn('[approvals] email failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
        void logEmailSent({ to: reviewerEmail, subject: `Approval Requested`, eventType: 'approval_requested', entityType: 'approval', entityId: data.id, status: 'failed', error: String(emailErr) });
      }
    })();
  }

  return NextResponse.json({ success: true, approval: data }, { status: 201 });
}
