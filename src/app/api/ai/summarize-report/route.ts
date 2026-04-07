import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * POST /api/ai/summarize-report
 * Summarize report data in natural language.
 * Body: { reportData: string | object }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager', 'client']);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI features not configured.' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { reportData } = body;
    if (!reportData) {
      return NextResponse.json({ success: false, error: 'reportData is required' }, { status: 400 });
    }

    const dataText = typeof reportData === 'string' ? reportData : JSON.stringify(reportData, null, 2);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst. Summarize the provided report data in 3-5 clear sentences highlighting key insights, trends, and any notable issues. Be concise and actionable.',
          },
          { role: 'user', content: dataText.slice(0, 8000) }, // Limit input
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({ success: false, error: String((err?.error as Record<string, unknown>)?.message ?? `OpenAI error ${res.status}`) }, { status: 502 });
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return NextResponse.json({ success: false, error: 'No response from AI' }, { status: 502 });

    return NextResponse.json({ success: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
