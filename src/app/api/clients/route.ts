/**
 * POST /api/clients
 *
 * Creates a new client record.
 *
 * Auth: requires 'admin', 'manager', or 'team_member' role.
 *
 * Request body (JSON):
 *   { name, email?, phone?, website?, industry?, status?, notes? }
 *
 * Success response:
 *   { success: true, client: { ...createdClient } }
 *
 * Error response:
 *   { success: false, step: "validation" | "db_insert", error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { notifyClientCreated } from '@/lib/notification-service';
import { processEvent } from '@/lib/event-engine';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { CLIENT_LIST_COLUMNS } from '@/lib/supabase-list-columns';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 200);
  const cursor = searchParams.get('cursor');

  let query = db
    .from('clients')
    .select(CLIENT_LIST_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const last = sliced[sliced.length - 1] as { created_at?: string } | undefined;
  return NextResponse.json({
    success: true,
    clients: sliced,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? (last?.created_at ?? null) : null,
    },
  });
}

export async function POST(request: NextRequest) {
  // 1. Auth & role check
  const auth = await requireRole(request, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  // 2. Parse request body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn('[POST /api/clients] body parse error:', err);
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // 3. Validate required fields
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    console.warn('[POST /api/clients] validation failed: name is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Company name is required' },
      { status: 400 },
    );
  }

  // 4. Build insert payload (only allow known fields)
  const insertPayload: Record<string, string> = { name };
  const optionalFields = [
    'email',
    'phone',
    'website',
    'industry',
    'status',
    'notes',
    'default_currency',
  ] as const;
  for (const field of optionalFields) {
    const val = body[field];
    if (typeof val === 'string' && val.trim() !== '') {
      insertPayload[field] = val.trim();
    }
  }

  // Use 'active' as the default status if not provided
  if (!insertPayload.status) {
    insertPayload.status = 'active';
  }

  // 5. DB insert (service-role bypasses RLS — role already verified above)
  const db = getServiceClient();
  const {
    workspaceId,
    workspaceKey,
    error: workspaceError,
  } = await resolveWorkspaceForRequest(request, db, auth.profile.id);
  if (!workspaceId) {
    return NextResponse.json(
      {
        success: false,
        step: 'workspace_resolution',
        error: workspaceError ?? `Unable to resolve workspace for key "${workspaceKey}"`,
      },
      { status: 500 },
    );
  }
  insertPayload.workspace_id = workspaceId;

  const { data, error } = await db
    .from('clients')
    .insert(insertPayload)
    .select(CLIENT_LIST_COLUMNS)
    .single();

  if (error) {
    console.error(
      '[POST /api/clients] db_insert error — code:',
      error.code,
      '| message:',
      error.message,
    );
    return NextResponse.json(
      { success: false, step: 'db_insert', error: error.message },
      { status: 500 },
    );
  }

  if (data?.id) {
    void processEvent({
      event_type: 'client.created',
      actor_id: auth.profile.id,
      entity_type: 'client',
      entity_id: data.id as string,
      payload: {
        clientName: data.name as string,
      },
    });

    void (async () => {
      try {
        const { data: admins } = await db
          .from('team_members')
          .select('profile_id')
          .eq('role', 'admin');
        const adminUserIds = (admins ?? [])
          .map((m: { profile_id?: string | null }) => m.profile_id)
          .filter((v): v is string => Boolean(v));
        if (adminUserIds.length === 0) return;
        await notifyClientCreated({
          clientId: data.id as string,
          clientName: data.name as string,
          actorId: auth.profile.id,
          adminUserIds,
        });
      } catch (err) {
        console.warn(
          '[POST /api/clients] notifyClientCreated failed:',
          err instanceof Error ? err.message : String(err),
        );
      }
    })();
  }

  return NextResponse.json({ success: true, client: data });
}
