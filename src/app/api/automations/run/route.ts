import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { runWorkspaceAutomations } from '@/lib/automations/runner';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const { workspaceId, error } = await resolveWorkspaceForRequest(req, db, auth.profile.id);
  if (!workspaceId || error) {
    return NextResponse.json(
      { success: false, error: error ?? 'Workspace not found' },
      { status: 400 },
    );
  }

  const result = await runWorkspaceAutomations(workspaceId);
  return NextResponse.json({ success: true, result });
}
