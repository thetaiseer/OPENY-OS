/**
 * GET /api/content-items
 *   List content items. Query params: client_id, status, platform
 *
 * POST /api/content-items
 *   Create a content item.
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import {
  insertContentItemWithClientFallback,
  sanitizeContentItemsApiError,
  selectContentItemsWithClientFallback,
} from '@/lib/content-items-query';

const VALID_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'published',
  'rejected',
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');

  try {
    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      db,
      auth.profile.id,
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          step: 'workspace_resolution',
          error: workspaceError ?? 'Workspace not found',
        },
        { status: 500 },
      );
    }
    const { data, error } = await selectContentItemsWithClientFallback({
      db,
      workspaceId,
      clientId,
      status,
      platform,
    });
    if (error) {
      console.error('[GET /api/content-items] query_failed', {
        code: error.code,
        message: error.message,
        workspaceId,
        clientId,
        status,
        platform,
      });
      return NextResponse.json(
        { success: false, error: sanitizeContentItemsApiError(error) },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, items: data ?? [] });
  } catch (error) {
    console.error('[GET /api/content-items] unhandled_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : null;
  const rawStatus = typeof body.status === 'string' ? body.status : 'draft';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'draft';

  if (!title) {
    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
  }

  const scheduleDate = typeof body.schedule_date === 'string' ? body.schedule_date.trim() : null;

  const payload: Record<string, unknown> = {
    title,
    status,
    client_id: clientId || null,
    description: typeof body.description === 'string' ? body.description.trim() : null,
    caption: typeof body.caption === 'string' ? body.caption.trim() : null,
    platform_targets: Array.isArray(body.platform_targets) ? body.platform_targets : [],
    post_types: Array.isArray(body.post_types) ? body.post_types : [],
    purpose: typeof body.purpose === 'string' ? body.purpose : null,
    created_by: auth.profile.id,
    ...(scheduleDate ? { schedule_date: scheduleDate } : {}),
  };

  try {
    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      db,
      auth.profile.id,
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          step: 'workspace_resolution',
          error: workspaceError ?? 'Workspace not found',
        },
        { status: 500 },
      );
    }
    payload.workspace_id = workspaceId;
    const { data, error } = await insertContentItemWithClientFallback({ db, payload });

    if (error) {
      console.error('[POST /api/content-items] query_failed', {
        code: error.code,
        message: error.message,
        workspaceId,
      });
      return NextResponse.json(
        { success: false, error: sanitizeContentItemsApiError(error) },
        { status: 500 },
      );
    }

    const createdItem = data as { id?: string } | null;

    // Activity log (best-effort)
    void db.from('activities').insert({
      workspace_id: workspaceId,
      type: 'content_item_created',
      description: `Content item "${title}" created`,
      user_id: auth.profile.id,
      user_uuid: auth.profile.id,
      client_id: clientId || null,
      entity_type: 'content_item',
      entity_id: createdItem?.id ?? null,
    });

    // Auto-create calendar event when content has a schedule_date or scheduled status
    if (createdItem?.id && (scheduleDate || status === 'scheduled')) {
      const calStartsAt = scheduleDate
        ? `${scheduleDate}T09:00:00`
        : `${new Date().toISOString().slice(0, 10)}T09:00:00`;
      void db
        .from('calendar_events')
        .insert({
          workspace_id: workspaceId,
          title: `Content: ${title}`,
          event_type: 'publishing',
          starts_at: calStartsAt,
          client_id: clientId || null,
          status: 'active',
          notes: null,
        })
        .then(({ error: calErr }) => {
          if (calErr)
            console.warn(
              '[POST /api/content-items] calendar event auto-create failed:',
              calErr.message,
            );
        });
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/content-items] unhandled_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
