/**
 * GET /api/team/invite/[token]
 *
 * Validates an invite token and returns the invitation details.
 * Public route — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  const { data: invitation, error } = await db
    .from('team_invitations')
    .select('id, email, full_name, role, status, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status === 'revoked') {
    return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 410 });
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 });
  }

  if (invitation.status === 'expired' || new Date(invitation.expires_at) <= new Date()) {
    // Mark as expired in DB if not already
    if (invitation.status === 'invited') {
      await db
        .from('team_invitations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
    }
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  return NextResponse.json({
    full_name:  invitation.full_name,
    email:      invitation.email,
    role:       invitation.role,
    expires_at: invitation.expires_at,
  });
}
