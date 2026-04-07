import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';

/**
 * POST /api/ai/generate-content
 * Generate social media captions / post copy using AI (OpenAI or Gemini).
 * Body: { platform: string, tone?: string, topic?: string, clientName?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team', 'manager', 'client']);
    if (auth instanceof NextResponse) return auth;

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

    try {
      const content = await callAI({
        system: 'You are a creative social media copywriter.',
        user: prompt,
        maxTokens: 512,
        temperature: 0.8,
      });
      return NextResponse.json({ success: true, content });
    } catch (aiErr: unknown) {
      if (aiErr instanceof AiUnconfiguredError) {
        return NextResponse.json({ success: false, error: 'AI features not configured. Set OPENAI_API_KEY or GEMINI_API_KEY.' }, { status: 503 });
      }
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
