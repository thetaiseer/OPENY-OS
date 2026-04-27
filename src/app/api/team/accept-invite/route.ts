import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { normalizeWorkspaceKey } from '@/lib/workspace-access';

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiUser(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token)
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });

    const db = getServiceClient();
    const nowIso = new Date().toISOString();
    const { data: invitation } = await db
      .from('workspace_invitations')
      .select('id, workspace_id, email, role, status, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!invitation)
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is not pending' }, { status: 409 });
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await db
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
        .eq('status', 'pending');
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }
    if ((auth.profile.email ?? '').toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You must sign in with the invited email address to accept this invitation.' },
        { status: 403 },
      );
    }

    const normalizedRole = String(invitation.role).toLowerCase();
    const memberRole =
      normalizedRole === 'owner' || normalizedRole === 'admin' ? normalizedRole : 'member';

    const { error: workspaceMemberError } = await db.from('workspace_members').upsert(
      {
        workspace_id: invitation.workspace_id,
        user_id: auth.profile.id,
        role: memberRole,
      },
      { onConflict: 'workspace_id,user_id' },
    );
    if (workspaceMemberError) {
      return NextResponse.json({ error: workspaceMemberError.message }, { status: 500 });
    }

    const { data: workspace } = await db
      .from('workspaces')
      .select('slug, name')
      .eq('id', invitation.workspace_id)
      .maybeSingle();
    const workspaceKey =
      normalizeWorkspaceKey(workspace?.slug) ?? normalizeWorkspaceKey(workspace?.name) ?? 'os';
    await db.from('workspace_memberships').upsert(
      {
        user_id: auth.profile.id,
        workspace_id: invitation.workspace_id,
        workspace_key: workspaceKey,
        role: memberRole,
        is_active: true,
      },
      { onConflict: 'user_id,workspace_key' },
    );

    const { error: acceptError } = await db
      .from('workspace_invitations')
      .update({ status: 'accepted', accepted_at: nowIso })
      .eq('id', invitation.id)
      .eq('status', 'pending');
    if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/team/accept-invite] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Failed to accept invitation. Please retry.', details: message },
      { status: 500 },
    );
  }
}
