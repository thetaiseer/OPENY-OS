import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Public signup is disabled. You must be invited by a workspace admin.' },
    { status: 403 },
  );
}
