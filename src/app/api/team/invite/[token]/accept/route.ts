import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Public account activation is disabled. Contact your workspace administrator.' },
    { status: 403 },
  );
}
