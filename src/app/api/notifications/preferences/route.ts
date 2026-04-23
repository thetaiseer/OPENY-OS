/**
 * GET  /api/notifications/preferences — fetch current user's preferences
 * POST /api/notifications/preferences — upsert preferences (one or many)
 *
 * Body for POST (array or single object):
 *   [{
 *     event_type: string;
 *     in_app_enabled?: boolean;
 *     email_enabled?: boolean;
 *     realtime_enabled?: boolean;
 *     digest_enabled?: boolean;
 *     mute_until?: string | null;   // ISO timestamp
 *   }]
 *
 * Critical events (system category) cannot be fully muted by normal users —
 * the mute_until field is silently ignored for those event types.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

// Critical event types — cannot be muted by non-admin users
const UNMUTABLE_EVENT_TYPES = new Set([
  'critical.system_error',
  'storage.upload_error',
  'api.failure',
  'integration.disconnected',
  'login.new_device',
  'content.publish_failed',
]);

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const { data, error } = await db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', auth.profile.id)
    .order('event_type');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: data ?? [] });
}

interface PreferenceInput {
  event_type: string;
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  realtime_enabled?: boolean;
  digest_enabled?: boolean;
  mute_until?: string | null;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const items: PreferenceInput[] = Array.isArray(body) ? body : [body as PreferenceInput];
  if (!items.length) {
    return NextResponse.json({ success: false, error: 'Empty preferences array' }, { status: 400 });
  }

  const isAdmin = auth.profile.role === 'admin' || auth.profile.role === 'owner';
  const db = getServiceClient();
  const now = new Date().toISOString();
  const rows = items
    .map((item) => {
      const eventType = String(item.event_type ?? '');
      const isCritical = UNMUTABLE_EVENT_TYPES.has(eventType);
      const row: Record<string, unknown> = {
        user_id: auth.profile.id,
        event_type: eventType,
        updated_at: now,
      };
      if (typeof item.in_app_enabled === 'boolean') row.in_app_enabled = item.in_app_enabled;
      if (typeof item.email_enabled === 'boolean') row.email_enabled = item.email_enabled;
      if (typeof item.realtime_enabled === 'boolean') row.realtime_enabled = item.realtime_enabled;
      if (typeof item.digest_enabled === 'boolean') row.digest_enabled = item.digest_enabled;
      // Enforce policy: critical events cannot be muted unless user is admin
      if (!isCritical || isAdmin) {
        if (item.mute_until !== undefined) row.mute_until = item.mute_until ?? null;
      }
      return row;
    })
    .filter((r) => typeof r.event_type === 'string' && r.event_type.length > 0);

  if (!rows.length) {
    return NextResponse.json(
      { success: false, error: 'No valid preferences provided' },
      { status: 400 },
    );
  }

  const { data, error } = await db
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,event_type' })
    .select();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: data ?? [] });
}
