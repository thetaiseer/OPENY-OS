/**
 * GET  /api/projects        — list projects (filterable by client_id, status)
 * POST /api/projects        — create a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { emitEvent, EVENT } from '@/lib/workspace-events';
import { PROJECT_WITH_CLIENT } from '@/lib/supabase-list-columns';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

const VALID_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');

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
    let query = db
      .from('projects')
      .select(PROJECT_WITH_CLIENT)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (clientId) query = query.eq('client_id', clientId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, projects: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/projects] error:', message);
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  }

  const rawStatus = typeof body.status === 'string' ? body.status : 'active';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'active';

  const payload: Record<string, unknown> = {
    name,
    status,
    client_id: typeof body.client_id === 'string' ? body.client_id.trim() : null,
    description: typeof body.description === 'string' ? body.description.trim() : null,
    start_date: typeof body.start_date === 'string' ? body.start_date.trim() : null,
    end_date: typeof body.end_date === 'string' ? body.end_date.trim() : null,
    color: typeof body.color === 'string' ? body.color.trim() : '#6366f1',
    created_by: auth.profile.id,
  };

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
  const { data, error } = await db
    .from('projects')
    .insert(payload)
    .select(PROJECT_WITH_CLIENT)
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Activity log + workspace event (fire-and-forget)
  void db.from('activities').insert({
    workspace_id: workspaceId,
    type: 'project_created',
    description: `Project "${name}" created`,
    client_id: payload.client_id || null,
    entity_type: 'project',
    entity_id: data?.id ?? null,
    user_uuid: auth.profile.id,
  });

  void emitEvent(db, {
    event_type: EVENT.PROJECT_CREATED,
    entity_type: 'project',
    entity_id: data?.id,
    actor_id: auth.profile.id,
    payload: { project: data },
  });

  return NextResponse.json({ success: true, project: data }, { status: 201 });
}
