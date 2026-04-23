import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

// DELETE /api/auth/sessions/[id] — revoke a single session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: sessionId } = await params;
  const admin = getServiceClient();

  // Only allow revoking sessions that belong to this user
  const { error } = await admin
    .from('user_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: auth.profile.email,
    })
    .eq('id', sessionId)
    .eq('user_id', auth.profile.id);

  if (error) {
    // Table not yet created — nothing to revoke
    if (error.code === PG_UNDEFINED_TABLE) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const currentSid = request.cookies.get('openy-sid')?.value;
  const response = NextResponse.json({ success: true });

  // If the user revoked their own current session, clear the cookie
  if (sessionId === currentSid) {
    response.cookies.delete('openy-sid');
  }

  return response;
}
