import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * POST /api/ai/generate-tasks
 * Generate task suggestions for a client using OpenAI.
 * Body: { clientId?: string, clientName?: string, description?: string, count?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI features not configured. Set OPENAI_API_KEY.' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { clientName, description, count = 5 } = body;
    if (!clientName && !description) {
      return NextResponse.json({ success: false, error: 'Provide clientName or description' }, { status: 400 });
    }

    const prompt = [
      description ? `Project description: ${description}` : '',
      clientName  ? `Client: ${clientName}` : '',
      `Generate ${count} concrete, actionable task titles for a social media marketing agency.`,
      'Return a JSON array of strings, e.g. ["Task 1","Task 2"]. No extra text.',
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a project manager assistant. Return only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({ success: false, error: String((err?.error as Record<string, unknown>)?.message ?? `OpenAI error ${res.status}`) }, { status: 502 });
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]';

    let tasks: string[];
    try {
      tasks = JSON.parse(raw) as string[];
      if (!Array.isArray(tasks)) throw new Error('Not an array');
    } catch {
      // Fallback: split by newline
      tasks = raw.split('\n').map(l => l.replace(/^[\d\-\.\*]+\s*/, '').trim()).filter(Boolean);
    }

    return NextResponse.json({ success: true, tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
