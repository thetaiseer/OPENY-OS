import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * POST /api/ai/generate-content
 * Generate social media captions / post copy.
 * Body: { platform: string, tone?: string, topic?: string, clientName?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager', 'client']);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI features not configured. Set OPENAI_API_KEY.' }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { platform = 'Instagram', tone = 'professional', topic, clientName } = body;
    if (!topic) {
      return NextResponse.json({ success: false, error: 'topic is required' }, { status: 400 });
    }

    const prompt = [
      `Write a ${tone} ${platform} post about: ${topic}.`,
      clientName ? `Brand: ${clientName}.` : '',
      'Include relevant emojis and hashtags.',
      'Return just the post text, no extra explanation.',
    ].filter(Boolean).join(' ');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a creative social media copywriter.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 512,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json({ success: false, error: String((err?.error as Record<string, unknown>)?.message ?? `OpenAI error ${res.status}`) }, { status: 502 });
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return NextResponse.json({ success: false, error: 'No response from AI' }, { status: 502 });

    return NextResponse.json({ success: true, content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
