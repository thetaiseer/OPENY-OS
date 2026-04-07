import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

interface TaskInput {
  id: string;
  title: string;
  priority: string;
  due_date?: string;
  status: string;
}

/**
 * POST /api/ai/suggest-schedule
 * Suggest an optimized task schedule.
 * Body: { tasks: TaskInput[], context?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI features not configured.' }, { status: 503 });
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a scheduling assistant. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({ success: false, error: String((err?.error as Record<string, unknown>)?.message ?? `OpenAI error ${res.status}`) }, { status: 502 });
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]';

    let schedule: { id: string; suggestedOrder: number; reason: string }[];
    try {
      schedule = JSON.parse(raw) as typeof schedule;
    } catch {
      return NextResponse.json({ success: false, error: 'AI returned invalid schedule format' }, { status: 502 });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
