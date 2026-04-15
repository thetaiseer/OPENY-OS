import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const moduleName = searchParams.get('module') ?? '';

  const db = getServiceClient();
  let q = db.from('docs_backups').select('id, module, label, created_at').order('created_at', { ascending: false });
  if (moduleName) q = q.eq('module', moduleName);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ backups: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { module: backupModule, data: backupData, label } = body as {
    module?: string;
    data?: unknown;
    label?: string;
  };

  if (!backupModule) return NextResponse.json({ error: 'module is required' }, { status: 400 });
  if (!backupData)   return NextResponse.json({ error: 'data is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_backups')
    .insert({ module: backupModule, data: backupData, label: label ?? null, created_by: auth.profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ backup: data }, { status: 201 });
}
