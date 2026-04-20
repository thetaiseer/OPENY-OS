import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Invitation token validation is disabled. Contact your workspace administrator.' },
    { status: 403 },
  );
}
