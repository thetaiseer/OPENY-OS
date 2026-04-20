import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationToken } from '@/lib/team-invitations';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : undefined;
  const fullName = typeof body?.full_name === 'string' ? body.full_name : undefined;

  console.log('[invitations/accept] Token sent to backend:', token);
  const result = await acceptInvitationToken(request, token, password, fullName);
  return NextResponse.json(result.body, { status: result.status });
}
