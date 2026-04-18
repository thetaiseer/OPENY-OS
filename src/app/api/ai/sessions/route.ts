import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const userId = auth.profile.id;
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 20)));

  const { data: sessions, error } = await db
    .from('ai_sessions')
    .select('id, mode, section, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!sessions?.length) return NextResponse.json({ success: true, sessions: [] });

  const sessionIds = sessions.map(s => s.id as string);
  const { data: actions } = await db
    .from('ai_actions')
    .select('id, session_id, prompt, response_text, status, created_at')
    .eq('user_id', userId)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });

  const grouped = new Map<string, { prompt: string; response_text: string | null; status: string; created_at: string }>();
  for (const action of actions ?? []) {
    const sid = String(action.session_id ?? '');
    if (!sid || grouped.has(sid)) continue;
    grouped.set(sid, {
      prompt: String(action.prompt ?? ''),
      response_text: (action.response_text as string | null) ?? null,
      status: String(action.status ?? 'success'),
      created_at: String(action.created_at ?? ''),
    });
  }

  return NextResponse.json({
    success: true,
    sessions: sessions.map((session) => {
      const latest = grouped.get(String(session.id));
      const titleSource = latest?.prompt || 'New conversation';
      return {
        ...session,
        title: titleSource.slice(0, 60),
        latest_prompt: latest?.prompt ?? '',
        latest_response: latest?.response_text ?? '',
        latest_status: latest?.status ?? 'pending',
        latest_at: latest?.created_at ?? session.created_at,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: { mode?: string; section?: string; entity_type?: string | null; entity_id?: string | null };
  try { body = await req.json(); } catch { body = {}; }

  const mode = ['ask', 'do', 'suggest', 'review'].includes(body.mode ?? '') ? body.mode : 'ask';
  const db = getServiceClient();
  const { data, error } = await db
    .from('ai_sessions')
    .insert({
      user_id: auth.profile.id,
      mode,
      section: body.section ?? null,
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
    })
    .select('id, mode, section, created_at')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, session: data }, { status: 201 });
}
