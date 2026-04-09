/**
 * GET /api/approvals/[id]
 *   Get a single approval by ID.
 *
 * PATCH /api/approvals/[id]
 *   Update an approval (status, notes, reviewer_id).
 *   Automatically sets approved_at / rejected_at when status changes.
 *   When a task's approval is resolved, optionally syncs task status.
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { notifyApprovalDecision } from '@/lib/notification-service';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

interface Params { id: string }

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const db = getSupabase();

    const { data, error } = await db
      .from('approvals')
      .select(`
        *,
        client:clients(id, name),
        reviewer:profiles(id, name, email, avatar),
        task:tasks(id, title),
        asset:assets(id, name),
        content_item:content_items(id, title)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Approval not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, approval: data });
  } catch (err) {
    console.error('[GET /api/approvals/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const db = getSupabase();

    const { data: existing, error: fetchErr } = await db
      .from('approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: 'Approval not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.status === 'string') {
      const rawStatus = body.status;
      if ((VALID_STATUSES as readonly string[]).includes(rawStatus)) {
        updates.status = rawStatus;

        // Stamp approval/rejection timestamps
        if (rawStatus === 'approved' && !existing.approved_at) {
          updates.approved_at = new Date().toISOString();
          updates.rejected_at = null;
        }
        if (rawStatus === 'rejected' && !existing.rejected_at) {
          updates.rejected_at = new Date().toISOString();
          updates.approved_at = null;
        }
        if (rawStatus === 'pending') {
          updates.approved_at = null;
          updates.rejected_at = null;
        }
      }
    }
    if ('notes' in body) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }
    if (typeof body.reviewer_id === 'string') {
      updates.reviewer_id = body.reviewer_id.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await db
      .from('approvals')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(id,name), reviewer:profiles(id,name,email,avatar)')
      .single();

    if (updateErr || !updated) {
      console.error('[PATCH /api/approvals/[id]] error:', updateErr?.message);
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update approval' },
        { status: 500 },
      );
    }

    // ── Sync linked task status when approval is resolved ─────────────────────
    // Only sync on approved/rejected transitions; pending resets leave the task unchanged.
    if (updates.status && existing.task_id && updates.status !== 'pending') {
      const taskStatus = updates.status === 'approved' ? 'approved' : 'in_review';
      void db.from('tasks')
        .update({ status: taskStatus, updated_at: new Date().toISOString() })
        .eq('id', existing.task_id)
        .then(({ error: taskErr }) => {
          if (taskErr) console.warn('[PATCH /api/approvals/[id]] task sync failed:', taskErr.message);
        });
    }

    // ── Sync linked asset approval_status (backward compat during transition) ─
    if (updates.status && existing.asset_id) {
      const assetApprovalStatus = updates.status === 'approved' ? 'approved'
        : updates.status === 'rejected' ? 'rejected'
        : 'pending';
      void db.from('assets')
        .update({ approval_status: assetApprovalStatus })
        .eq('id', existing.asset_id)
        .then(({ error: aErr }) => {
          if (aErr) console.warn('[PATCH /api/approvals/[id]] asset sync failed:', aErr.message);
        });
    }

    // Activity log (best-effort)
    if (updates.status) {
      void db.from('activities').insert({
        type:        `approval_${updates.status}`,
        description: `Approval ${updates.status} by ${auth.profile.name ?? auth.profile.email}`,
        user_id:     auth.profile.id,
        user_uuid:   auth.profile.id,
        client_id:   existing.client_id ?? null,
        entity_type: 'approval',
        entity_id:   id,
      }).then(({ error: actErr }) => {
        if (actErr) console.warn('[PATCH /api/approvals/[id]] activity log failed:', actErr.message);
      });

      // Notification for approval decision (best-effort)
      const decision = updates.status as string;
      if (decision === 'approved' || decision === 'rejected' || decision === 'needs_changes') {
        void notifyApprovalDecision({
          approvalId:    id,
          taskId:        existing.task_id ?? null,
          taskTitle:     null,
          decision:      decision as 'approved' | 'rejected' | 'needs_changes',
          decidedByName: auth.profile.name ?? auth.profile.email,
          requestedById: existing.requested_by ?? null,
          clientId:      existing.client_id ?? null,
        });
      }
    }

    return NextResponse.json({ success: true, approval: updated });
  } catch (err) {
    console.error('[PATCH /api/approvals/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
