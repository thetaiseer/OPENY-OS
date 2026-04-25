/**
 * GET    /api/content-items/[id] — get a single content item
 * PATCH  /api/content-items/[id] — update title/status/caption/etc.
 * DELETE /api/content-items/[id] — delete (admin/manager only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { CONTENT_ITEM_WITH_CLIENT } from '@/lib/supabase-list-columns';

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
    const { data, error } = await db
      .from('content_items')
      .select(CONTENT_ITEM_WITH_CLIENT)
      .eq('id', id)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    return NextResponse.json({ success: true, item: data });
  } catch {
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

    const { data, error } = await db
      .from('content_items')
      .update(updates)
      .eq('id', id)
      .select(CONTENT_ITEM_WITH_CLIENT)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

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
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const db = getServiceClient();

    // Fetch before delete for activity logging
    const { data: existing } = await db
      .from('content_items')
      .select('id, title, client_id')
      .eq('id', id)
      .single();

    const { error } = await db.from('content_items').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // Log deletion activity (fire-and-forget)
    if (existing) {
      void db.from('activities').insert({
        type: 'content_deleted',
        description: `Content "${existing.title}" deleted`,
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
