import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const userId = auth.profile.id;

  const { data: session, error: sessionError } = await db
    .from('ai_sessions')
    .select('id, mode, section, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (sessionError) return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });

  const { data: actions, error } = await db
    .from('ai_actions')
    .select('id, intent, prompt, response_text, status, error_message, actions_taken, created_at')
    .eq('session_id', id)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    session,
    messages: (actions ?? []).flatMap((a) => {
      const ts = a.created_at as string;
      const items: Array<Record<string, unknown>> = [
        {
          id: `${a.id}-u`,
          role: 'user',
          content: a.prompt,
          timestamp: ts,
          intent: a.intent,
        },
      ];
      if (a.response_text) {
        items.push({
          id: `${a.id}-a`,
          role: 'assistant',
          content: a.response_text,
          timestamp: ts,
          intent: a.intent,
          status: a.status,
          actions_taken: a.actions_taken ?? [],
          error_message: a.error_message ?? null,
        });
      }
      return items;
    }),
  });
}
