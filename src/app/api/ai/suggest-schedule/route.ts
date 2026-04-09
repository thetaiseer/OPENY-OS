import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';

interface TaskInput {
  id: string;
  title: string;
  priority: string;
  due_date?: string;
  status: string;
}

/**
 * POST /api/ai/suggest-schedule
 * Suggest an optimized task schedule using Gemini.
 * Body: { tasks: TaskInput[], context?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const rl = checkRateLimit(`ai:user:${auth.profile.id}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { tasks, context } = body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ success: false, error: 'tasks array is required' }, { status: 400 });
    }

    const taskList = (tasks as TaskInput[]).map((t, i) =>
      `${i + 1}. "${t.title}" — priority: ${t.priority}, due: ${t.due_date ?? 'no deadline'}, status: ${t.status}`
    ).join('\n');

    const prompt = [
      'You are a project scheduling assistant.',
      context ? `Context: ${context}` : '',
      'Reorder and schedule these tasks optimally (considering priority and deadlines):',
      taskList,
      'Return a JSON array of objects: [{"id":"...","suggestedOrder":1,"reason":"..."}]',
      'No extra text.',
    ].filter(Boolean).join('\n');

    try {
      const raw = await callAI({
        system: 'You are a scheduling assistant. Return only valid JSON.',
        user: prompt,
        maxTokens: 1024,
        temperature: 0.4,
      });

      let schedule: { id: string; suggestedOrder: number; reason: string }[];
      try {
        schedule = JSON.parse(raw) as typeof schedule;
      } catch {
        return NextResponse.json({ success: false, error: 'AI returned invalid schedule format' }, { status: 502 });
      }

      return NextResponse.json({ success: true, schedule });
    } catch (aiErr: unknown) {
      if (aiErr instanceof AiUnconfiguredError) {
        return NextResponse.json({ success: false, error: 'AI features not configured. Set GEMINI_API_KEY.' }, { status: 503 });
      }
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
