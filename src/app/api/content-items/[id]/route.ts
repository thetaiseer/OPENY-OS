/**
 * GET    /api/content-items/[id] — get a single content item
 * PATCH  /api/content-items/[id] — update title/status/caption/etc.
 * DELETE /api/content-items/[id] — delete (admin/manager only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import {
  sanitizeContentItemsApiError,
  selectSingleContentItemWithClientFallback,
  updateContentItemWithClientFallback,
} from '@/lib/content-items-query';

const VALID_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'published',
  'rejected',
] as const;

interface Params {
  id: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const db = getServiceClient();
    const { workspaceId } = await resolveWorkspaceForRequest(req, db, auth.profile.id);
    const { data, error } = await selectSingleContentItemWithClientFallback({
      db,
      id,
      workspaceId,
    });
    if (error) {
      console.error('[GET /api/content-items/[id]] query_failed', {
        code: error.code,
        message: error.message,
        contentItemId: id,
        workspaceId,
      });
      return NextResponse.json(
        { success: false, error: sanitizeContentItemsApiError(error) },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('[GET /api/content-items/[id]] unhandled_error', {
      message: error instanceof Error ? error.message : String(error),
      contentItemId: id,
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (typeof body.caption === 'string') updates.caption = body.caption.trim();
  if (typeof body.purpose === 'string') updates.purpose = body.purpose;
  if (Array.isArray(body.platform_targets)) updates.platform_targets = body.platform_targets;
  if (Array.isArray(body.post_types)) updates.post_types = body.post_types;

  let newStatus: string | null = null;
  if (
    typeof body.status === 'string' &&
    (VALID_STATUSES as readonly string[]).includes(body.status)
  ) {
    updates.status = body.status;
    newStatus = body.status;
  }

  try {
    const db = getServiceClient();

    // Fetch the current record to get previous status and client_id for activity logging
    const { data: existing } = await db
      .from('content_items')
      .select('id, title, status, client_id')
      .eq('id', id)
      .single();

    const { data, error } = await updateContentItemWithClientFallback({ db, id, updates });
    if (error) {
      console.error('[PATCH /api/content-items/[id]] query_failed', {
        code: error.code,
        message: error.message,
        contentItemId: id,
      });
      return NextResponse.json(
        { success: false, error: sanitizeContentItemsApiError(error) },
        { status: 500 },
      );
    }

    // Log activity when status changes (fire-and-forget)
    if (newStatus && existing && newStatus !== existing.status) {
      void db.from('activities').insert({
        type: 'content_status_changed',
        description: `Content "${existing.title}" moved from ${existing.status} to ${newStatus}`,
        user_id: auth.profile.id,
        user_uuid: auth.profile.id,
        client_id: existing.client_id ?? null,
        entity_type: 'content_item',
        entity_id: id,
      });

      // Auto-create calendar event when content becomes scheduled (fire-and-forget)
      const scheduleDate =
        typeof body.schedule_date === 'string' ? body.schedule_date.trim() : null;
      if (newStatus === 'scheduled' && scheduleDate) {
        void db
          .from('calendar_events')
          .insert({
            title: `Content: ${existing.title}`,
            event_type: 'publishing',
            starts_at: `${scheduleDate}T09:00:00`,
            client_id: existing.client_id ?? null,
            status: 'active',
            notes: null,
          })
          .then(({ error: calErr }) => {
            if (calErr)
              console.warn(
                '[PATCH /api/content-items/[id]] calendar event failed:',
                calErr.message,
              );
          });
      }
    }

    // Log general update activity if non-status fields changed (fire-and-forget)
    if (!newStatus && existing) {
      void db.from('activities').insert({
        type: 'content_updated',
        description: `Content "${existing.title}" updated`,
        user_id: auth.profile.id,
        user_uuid: auth.profile.id,
        client_id: existing.client_id ?? null,
        entity_type: 'content_item',
        entity_id: id,
      });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('[PATCH /api/content-items/[id]] unhandled_error', {
      message: error instanceof Error ? error.message : String(error),
      contentItemId: id,
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      db,
      auth.profile.id,
      { allowWorkspaceFallbackWithoutMembership: true },
    );
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: workspaceError ?? 'Workspace not found' },
        { status: 403 },
      );
    }
    const membershipCheck = await db
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', auth.profile.id)
      .maybeSingle();
    const membershipFound = Boolean(membershipCheck.data?.id);
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/content-items/[id] step=authorized', {
      recordId: id,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
    });

    // Fetch before delete for activity logging
    const { data: existing } = await db
      .from('content_items')
      .select('id, title, client_id, workspace_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Content item not found' },
        { status: 404 },
      );
    }

    const { error } = await db
      .from('content_items')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/content-items/[id] step=deleted', {
      recordId: id,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
      deleteResult: 'success',
    });

    // Log deletion activity (fire-and-forget)
    if (existing) {
      void db.from('activities').insert({
        type: 'content_deleted',
        description: `Content "${existing.title}" deleted`,
        workspace_id: workspaceId,
        user_id: auth.profile.id,
        user_uuid: auth.profile.id,
        client_id: existing.client_id ?? null,
        entity_type: 'content_item',
        entity_id: id,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
