import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * GET /api/team/email-config
 * Lets owners/admins see whether transactional email (Resend) is configured,
 * without exposing secrets. Used for in-app hints on the Team page.
 */
export async function GET(request: NextRequest) {
  const denied = await requireRole(request, ['owner', 'admin']);
  if (denied instanceof NextResponse) return denied;

  return NextResponse.json({
    transactionalEmailConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    inviteAppUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
  });
}
