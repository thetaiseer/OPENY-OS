import { NextRequest, NextResponse } from 'next/server';
import { runAutomationsAcrossWorkspaces } from '@/lib/automations/runner';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get('x-cron-secret');
  const query = new URL(req.url).searchParams.get('secret');
  return header === secret || query === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const results = await runAutomationsAcrossWorkspaces();
  return NextResponse.json({
    success: true,
    workspaces: results.length,
    actions: results.reduce((sum, row) => sum + row.actions, 0),
    errors: results.flatMap((row) => row.errors),
    results,
  });
}
