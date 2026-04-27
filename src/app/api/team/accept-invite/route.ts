import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationToken } from '@/lib/team-invitations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.password === 'string' ? body.password : undefined;
    const fullName = typeof body?.full_name === 'string' ? body.full_name : undefined;

    const result = await acceptInvitationToken(request, token, password, fullName);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/team/accept-invite] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Failed to accept invitation. Please retry.', details: message },
      { status: 500 },
    );
  }
}
