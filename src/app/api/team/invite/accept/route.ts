import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationToken } from '@/lib/team-invitations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.password === 'string' ? body.password : undefined;
    const fullName =
      typeof body?.fullName === 'string'
        ? body.fullName
        : typeof body?.full_name === 'string'
          ? body.full_name
          : undefined;

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password is required and must be at least 8 characters.' },
        { status: 400 },
      );
    }

    const result = await acceptInvitationToken(request, token, password, fullName);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/team/invite/accept] Unhandled error:', message);
    return NextResponse.json({ error: 'Failed to accept invitation.' }, { status: 500 });
  }
}
