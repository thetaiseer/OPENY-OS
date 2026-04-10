import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/generate-content
 * Generate social media captions / post copy using Gemini.
 * Body: { platform: string, tone?: string, topic?: string, clientName?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager', 'client']);
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

    const { platform = 'Instagram', tone = 'professional', topic, clientName } = body;
    if (!topic) {
      return NextResponse.json({ success: false, error: 'topic is required' }, { status: 400 });
    }

    const prompt = [
      `Write a complete, ready-to-publish ${tone} ${platform} post about: ${topic}.`,
      clientName ? `Brand / Client: ${clientName}.` : '',
      'Requirements:',
      '- Write the full post body — do NOT truncate or summarize.',
      '- Include an engaging opening hook.',
      '- Include a compelling call-to-action.',
      '- Add relevant emojis throughout.',
      '- Add a block of relevant hashtags at the end (10-15 hashtags).',
      '- Return ONLY the post text, no preamble or explanation.',
    ].filter(Boolean).join('\n');

    try {
      const content = await callAI({
        system: 'You are a professional social media copywriter who writes complete, polished, ready-to-publish posts. Never shorten or truncate your output. Always write the full post.',
        user: prompt,
        maxTokens: 2048,
        temperature: 0.8,
      });
      return NextResponse.json({ success: true, content });
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
