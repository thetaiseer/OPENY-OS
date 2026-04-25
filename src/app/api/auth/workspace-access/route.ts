import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { normalizeWorkspaceKey } from '@/lib/workspace-access';

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ allowed: false, error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = normalizeWorkspaceKey(request.nextUrl.searchParams.get('workspace'));
  if (!workspace) {
    return NextResponse.json({ allowed: false, error: 'Invalid workspace' }, { status: 400 });
  }

  if (auth.profile.role === 'owner') {
    return NextResponse.json({ allowed: true, workspace, role: 'owner' });
  }

  const db = getServiceClient();
  const { data: membership } = await db
    .from('workspace_members')
    .select('role')
    .eq('user_id', auth.profile.id)
    .eq('workspace_key', workspace)
    .eq('is_active', true)
    .maybeSingle();

  return NextResponse.json({
    allowed: Boolean(membership),
    workspace,
    role: membership?.role ?? null,
  });
}
