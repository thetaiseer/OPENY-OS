import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export type ImproveAction =
  | 'improve'
  | 'professional'
  | 'shorten'
  | 'expand'
  | 'name';

const ACTION_INSTRUCTION: Record<ImproveAction, string> = {
  /**
   * Smart short-text action: fix spelling, apply Title Case, clean formatting.
   * Keeps acronyms uppercase, preserves language, never translates.
   */
  name:
    'You are a professional proofreader and formatter for short names and labels. ' +
    'Fix any spelling mistakes, apply proper Title Case capitalization, clean up formatting, ' +
    'and make the text polished and professional. ' +
    'Keep well-known acronyms (like QR, SEO, UI, UX, PDF, API, HR) in UPPERCASE. ' +
    'For Arabic text, improve wording and fix obvious writing issues without changing the meaning. ' +
    'Preserve the original language — do NOT translate under any circumstances. ' +
    'Return ONLY the improved text, nothing else.',
  improve:
    'Improve the writing to make it clearer, more polished, and better structured. Preserve the original meaning and language. Do not translate.',
  professional:
    'Rewrite the text to sound more professional and business-appropriate. Preserve the original meaning and language.',
  shorten:
    'Shorten the text while keeping its key meaning and tone. Be concise. Preserve the original language.',
  expand:
    'Expand the text with more detail and context while preserving the original meaning and language.',
};

/** Count whitespace-separated words in a string. */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * POST /api/ai/improve
 *
 * Improves a piece of text using Gemini.
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
    const auth = await requireRole(req, ['admin', 'team', 'client', 'manager']);
    if (auth instanceof NextResponse) return auth;

    // Rate limit: 30 requests per minute per user
    const rl = checkRateLimit(`ai:user:${auth.profile.id}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Please wait a moment before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
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

    // Auto-upgrade short text: when action is 'improve' and text is ≤5 words,
    // use the 'name' prompt (spelling + title case + light polish) instead of the
    // full rewrite prompt, which would over-generate for short names and labels.
    const resolvedAction: ImproveAction =
      (action as ImproveAction) === 'improve' && countWords(text as string) <= 5
        ? 'name'
        : (action as ImproveAction);

    const instruction = ACTION_INSTRUCTION[resolvedAction];

    const systemPrompt =
      `You are a professional writing assistant. ${instruction} ` +
      'Return ONLY the improved text, no explanations, no quotation marks, no preamble.';

    try {
      const improved = await callAI({
        system: systemPrompt,
        user: (text as string).trim(),
        maxTokens: 1024,
        temperature: 0.6,
      });
      return NextResponse.json({ success: true, improved });
    } catch (aiErr: unknown) {
      if (aiErr instanceof AiUnconfiguredError) {
        return NextResponse.json(
          { success: false, error: 'AI writing features are not configured. Set GEMINI_API_KEY to enable them.' },
          { status: 503 },
        );
      }
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai/improve] error:', msg);
    return NextResponse.json({ success: false, error: `Server error: ${msg}` }, { status: 500 });
  }
}
