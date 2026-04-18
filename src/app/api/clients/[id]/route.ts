/**
 * PATCH /api/clients/[id]
 * Update client fields and emit client-updated notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { notifyClientUpdated } from '@/lib/notification-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ success: false, error: 'Client ID is required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowed = ['name', 'email', 'phone', 'website', 'industry', 'status', 'notes', 'default_currency'] as const;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowed) {
    if (typeof body[field] === 'string') {
      const v = (body[field] as string).trim();
      updates[field] = v || null;
    }
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  if (data?.id && data?.name) {
    void notifyClientUpdated({
      clientId: data.id as string,
      clientName: data.name as string,
    });
  }

  return NextResponse.json({ success: true, client: data });
}
