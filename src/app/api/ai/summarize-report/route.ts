import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/summarize-report
 * Summarize report data in natural language using Gemini.
 * Body: { reportData: string | object }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team_member', 'manager', 'client']);
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

    const { reportData } = body;
    if (!reportData) {
      return NextResponse.json({ success: false, error: 'reportData is required' }, { status: 400 });
    }

    const dataText = typeof reportData === 'string' ? reportData : JSON.stringify(reportData, null, 2);

    try {
      const summary = await callAI({
        system: 'You are a business analyst. Summarize the provided report data in 3-5 clear sentences highlighting key insights, trends, and any notable issues. Be concise and actionable.',
        user: dataText.slice(0, 8000), // Limit input
        maxTokens: 400,
        temperature: 0.5,
      });
      return NextResponse.json({ success: true, summary });
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
