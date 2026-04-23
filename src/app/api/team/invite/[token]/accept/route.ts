import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationToken, maskInvitationToken } from '@/lib/team-invitations';

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : undefined;
  const fullName = typeof body?.full_name === 'string' ? body.full_name : undefined;

  const result = await acceptInvitationToken(request, token, password, fullName);
  return NextResponse.json(result.body, { status: result.status });
}
