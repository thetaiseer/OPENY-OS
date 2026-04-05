import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export type ImproveAction =
  | 'improve'
  | 'professional'
  | 'shorten'
  | 'expand';

const ACTION_INSTRUCTION: Record<ImproveAction, string> = {
  improve:
    'Improve the writing to make it clearer, more polished, and better structured. Preserve the original meaning and language. Do not translate.',
  professional:
    'Rewrite the text to sound more professional and business-appropriate. Preserve the original meaning and language.',
  shorten:
    'Shorten the text while keeping its key meaning and tone. Be concise. Preserve the original language.',
  expand:
    'Expand the text with more detail and context while preserving the original meaning and language.',
};

/**
 * POST /api/ai/improve
 *
 * Improves a piece of text using OpenAI.
 *
 * Request body (JSON):
 *   text   – the text to improve (required)
 *   action – one of: improve | professional | shorten | expand  (default: "improve")
 *
 * Response:
 *   { success: true, improved: "..." }
 *   { success: false, error: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth — any logged-in role may use AI features
    const auth = await requireRole(req, ['admin', 'team', 'client']);
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI writing features are not configured. Set OPENAI_API_KEY to enable them.' },
        { status: 503 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const { text, action = 'improve' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    }

    if (!ACTION_INSTRUCTION[action as ImproveAction]) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${Object.keys(ACTION_INSTRUCTION).join(', ')}` },
        { status: 400 },
      );
    }

    const instruction = ACTION_INSTRUCTION[action as ImproveAction];

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              `You are a professional writing assistant. ${instruction} ` +
              'Return ONLY the improved text, no explanations, no quotation marks, no preamble.',
          },
          { role: 'user', content: text.trim() },
        ],
        max_tokens: 1024,
        temperature: 0.6,
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({})) as Record<string, unknown>;
      const errMsg = (errBody?.error as Record<string, unknown>)?.message ?? `OpenAI API error (HTTP ${openaiRes.status})`;
      return NextResponse.json({ success: false, error: String(errMsg) }, { status: 502 });
    }

    const data = await openaiRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const improved = data.choices?.[0]?.message?.content?.trim();
    if (!improved) {
      return NextResponse.json({ success: false, error: 'No response from AI' }, { status: 502 });
    }

    return NextResponse.json({ success: true, improved });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai/improve] error:', msg);
    return NextResponse.json({ success: false, error: `Server error: ${msg}` }, { status: 500 });
  }
}
